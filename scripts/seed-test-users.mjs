// Creates a few password-based test accounts for local multi-user testing,
// makes them friends with each other, shares a circle, and posts two
// overlapping activities (same category + timeframe) so there's an overlap
// banner ready to test Merge on immediately.
//
// Usage: node scripts/seed-test-users.mjs
//
// Requires NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in
// .env.local, and "Confirm email" turned off in Supabase's Auth settings
// (README step 1.5) so sign-up logs each mock account in immediately.
// Safe to re-run: existing mock accounts just log back in instead of
// re-signing up, though it will post a fresh duplicate circle/activities
// each time (harmless clutter — only re-run when you want new test data).

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const PASSWORD = "testpass123";
const MOCK_USERS = [
  { email: "mock-alice@extro.test", name: "Alice" },
  { email: "mock-bob@extro.test", name: "Bob" },
  { email: "mock-carol@extro.test", name: "Carol" },
];

function newClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signUpOrSignIn(email, name) {
  const client = newClient();
  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { name } },
  });
  if (signUpError) throw signUpError;
  if (signUpData.session) return { client, id: signUpData.user.id };

  // Already exists (or "Confirm email" is on) -- fall back to signing in.
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) {
    throw new Error(
      `Could not sign in as ${email}. If "Confirm email" is on in Supabase Auth settings, turn it off (README step 1.5) so throwaway accounts like this work.`
    );
  }
  return { client, id: signInData.user.id };
}

async function main() {
  console.log("Creating mock users...");
  const users = [];
  for (const u of MOCK_USERS) {
    const { client, id } = await signUpOrSignIn(u.email, u.name);
    users.push({ ...u, client, id });
    console.log(`  ${u.name} <${u.email}> ready`);
  }

  console.log("Friending all mock users with each other...");
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const a = users[i];
      const b = users[j];
      const { error } = await a.client
        .from("friend_requests")
        .insert({ requester_id: a.id, addressee_id: b.id });
      if (error && !error.message.includes("duplicate")) throw error;

      const { data: pending } = await b.client
        .from("friend_requests")
        .select("id")
        .eq("requester_id", a.id)
        .eq("addressee_id", b.id)
        .maybeSingle();
      if (pending) {
        await b.client.from("friend_requests").update({ status: "accepted" }).eq("id", pending.id);
      }
    }
  }

  console.log('Creating shared circle "Mock Squad"...');
  const owner = users[0];
  const { data: circle, error: circleError } = await owner.client
    .from("circles")
    .insert({ name: "Mock Squad", owner_id: owner.id })
    .select()
    .single();
  if (circleError) throw circleError;
  await owner.client
    .from("circle_members")
    .insert(users.map((u) => ({ circle_id: circle.id, member_id: u.id })));

  console.log("Posting two overlapping activities (Sport / Today)...");
  const [alice, bob] = users;
  for (const [author, text] of [
    [alice, "Up for volleyball this afternoon"],
    [bob, "Anyone want to play some sport today?"],
  ]) {
    const { data: activity, error } = await author.client
      .from("activities")
      .insert({ author_id: author.id, text, category: "Sport", timeframe: "Today" })
      .select()
      .single();
    if (error) throw error;
    await author.client
      .from("activity_visibility_circles")
      .insert({ activity_id: activity.id, circle_id: circle.id });
    await author.client
      .from("activity_joins")
      .insert({ activity_id: activity.id, person_id: author.id, status: "joined" });
  }

  console.log(`\nDone! Log in as any of these (password: ${PASSWORD}):`);
  for (const u of users) console.log(`  ${u.email}`);
  console.log('\nThey all share the "Mock Squad" circle and are mutual friends.');
  console.log(
    "Alice and Bob each posted a Sport/Today activity — log in as either (or Carol) to see the overlap banner and try Merge."
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
