import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Runs as a Vercel Node serverless function (web-push needs Node crypto).
export const runtime = "nodejs";

function truncate(text, n = 40) {
  if (!text) return "";
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
}

// Mirrors the in-app wording in components/NotificationBell.js.
function contentFor(type, actorName, activityText) {
  const activity = activityText ? ` “${truncate(activityText)}”` : "";
  switch (type) {
    case "friend_request":
      return { title: "New friend request", body: `${actorName} sent you a friend request`, url: "/friends" };
    case "friend_accepted":
      return { title: "Friend request accepted", body: `${actorName} accepted your friend request`, url: "/friends" };
    case "activity_response":
      return { title: "New response", body: `${actorName} responded to your activity${activity}`, url: "/" };
    case "activity_message":
      return { title: "New message", body: `${actorName} sent a message${activity ? ` in${activity}` : ""}`, url: "/" };
    default:
      return { title: "Extro", body: "You have a new notification", url: "/" };
  }
}

export async function POST(request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-webhook-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const record = payload?.record;
  if (!record?.recipient_id || !record?.type) {
    return new Response("ok", { status: 200 }); // nothing to send
  }
  // Only unread rows push -- this skips mark-read updates and lets the
  // message-collapse UPDATE (which resets read_at to null) re-notify.
  if (record.read_at) {
    return new Response("ok", { status: 200 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate || !vapidSubject) {
    return new Response("push not configured", { status: 500 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Resolve actor name + activity text (service role bypasses RLS).
  const [{ data: actor }, activityRes] = await Promise.all([
    admin.from("profiles").select("name").eq("id", record.actor_id).maybeSingle(),
    record.activity_id
      ? admin.from("activities").select("text").eq("id", record.activity_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { title, body, url: clickUrl } = contentFor(
    record.type,
    actor?.name || "Someone",
    activityRes.data?.text
  );
  const message = JSON.stringify({
    title,
    body,
    url: clickUrl,
    tag: `${record.type}:${record.activity_id || record.recipient_id}`,
  });

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", record.recipient_id);

  if (!subs?.length) return new Response("ok", { status: 200 });

  const results = await Promise.allSettled(
    subs.map((row) => webpush.sendNotification(row.subscription, message))
  );

  // Prune subscriptions the push service says are gone.
  const dead = [];
  results.forEach((r, i) => {
    if (r.status === "rejected" && [404, 410].includes(r.reason?.statusCode)) {
      dead.push(subs[i].id);
    }
  });
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);

  return new Response("ok", { status: 200 });
}
