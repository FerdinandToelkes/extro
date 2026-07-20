# Aktivitäten-Feed

Web-App zum Teilen mit deinem Freundeskreis. Läuft komplett im Browser über einen
Link — niemand muss etwas installieren.

**Stack:** Next.js (React, generiert die Web-Oberfläche) + Supabase (Postgres-
Datenbank + Login + Echtzeit-Updates, kostenlos für diese Größenordnung) +
Vercel (Hosting, kostenlos, gibt dir einen echten Link).

Warum dieser Stack: Er ist Web-Standard, braucht keinen eigenen Server, den du
verwalten musst, und beide Dienste (Supabase, Vercel) haben ein Web-Interface,
in dem du fast alles per Klick statt per Kommandozeile machst. Das passt gut
dazu, dass du eher aus Python/C++/Julia kommst — die eigentliche App-Logik in
diesem Repo ist bereits geschrieben; du musst v.a. Klicks in zwei Web-Oberflächen
machen und Umgebungsvariablen einfügen.

## 1. Supabase-Projekt anlegen (Datenbank + Login)

1. Auf https://supabase.com kostenlos registrieren, "New Project" klicken.
2. Warten bis das Projekt bereit ist (~2 Min).
3. Links im Menü auf **SQL Editor** → **New query** → Inhalt von
   `sql/schema.sql` reinkopieren → **Run**. Das legt alle Tabellen, den
   Auto-Profil-Trigger und die Zugriffsregeln an.
4. Links im Menü auf **Project Settings → API**. Dort findest du:
   - **Project URL** → kommt in `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → kommt in `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Login läuft per Magic-Link (E-Mail) — das ist bei Supabase standardmäßig an,
   du musst nichts umstellen.

## 2. Lokal testen (optional, aber empfohlen bevor du live gehst)

```bash
# Node.js falls nötig installieren (einmalig)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts

cd aktivitaeten-feed
cp .env.local.example .env.local
# .env.local öffnen und die zwei Werte aus Schritt 1.4 eintragen

npm install
npm run dev
```

Dann im Browser `http://localhost:3000` öffnen, mit deiner eigenen E-Mail
einloggen (Magic-Link landet im Postfach) und ausprobieren.

## 3. Auf GitHub pushen

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create aktivitaeten-feed --private --source=. --push
# falls du die GitHub-CLI (gh) nicht hast, alternativ ganz normal über
# github.com ein leeres Repo anlegen und die dort angezeigten git-Befehle nutzen
```

## 4. Auf Vercel deployen (→ echter Link)

1. Auf https://vercel.com mit deinem GitHub-Account einloggen.
2. **Add New → Project** → dein `aktivitaeten-feed`-Repo auswählen.
3. Bei **Environment Variables** die gleichen zwei Werte wie in `.env.local`
   eintragen (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. **Deploy** klicken. Nach ~1 Minute bekommst du einen Link wie
   `https://aktivitaeten-feed-xyz.vercel.app`.
5. Diesen Link kannst du direkt an Freunde schicken. Jeder meldet sich mit
   eigener E-Mail an und landet im gleichen Feed.

Jede Änderung, die du später committest und pushst, wird automatisch neu
deployed — kein erneutes manuelles Hochladen nötig.

## Was für den Test unter Freunden bewusst einfach gehalten ist

- **Zugriffsrechte (RLS):** Aktuell dürfen alle angemeldeten Nutzer alle
  Datensätze lesen (Schreiben nur für eigene Einträge). Das reicht für einen
  vertrauten Freundeskreis zum Testen, sollte aber verschärft werden, bevor
  ein größerer/fremder Kreis Zugriff bekommt.
- **"Zusammenlegen" bei Überschneidungen** legt aktuell eine neue,
  zusammengeführte Aktivität an, statt die ursprünglichen zwei technisch zu
  verschmelzen. Funktional passt das fürs Ausprobieren, ist aber ein Punkt,
  den wir später sauberer lösen können.
- **Freundeskreise** bestehen nur aus Leuten, die sich schon mal angemeldet
  haben (kein Adressbuch-Import). Für den ersten Testlauf im Freundeskreis
  reicht das.

## Weiterentwickeln

Sag mir einfach, was du basierend auf dem Feedback deiner Freunde ändern
willst — ich schreibe dir dann den passenden Code, und du musst nur noch
`git add . && git commit -m "..." && git push` ausführen, den Rest übernimmt
Vercel automatisch.
