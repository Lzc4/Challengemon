# Challengemon

Nuzlocke- und Soullocke-Runs im Browser. Jeder bringt seine eigenen Spiele und seinen eigenen Speicher mit, der Server sieht keine Spieldateien.

## Prinzip

- **ROMs, Randomizer-Patches und Spielstände** liegen im Speicher des Users: Browser (IndexedDB), Google Drive, Dropbox, S3-kompatibel oder WebDAV. Der Browser spricht direkt mit dem Anbieter, Zugangsdaten bleiben im Browser.
- **Der Server** speichert nur Konten, Runs, Tracker, Chat, Live-Status und Verwaltungsdaten (Dateiname, Größe, CRC32).
- **Randomizer:** Universal Pokemon Randomizer ZX 4.6.1 mit festem Seed.
  - Im Browser über CheerpJ (15–60 s je nach Spiel).
  - Oder als GitHub Action in einem privaten Repo im Account des Users (`challengemon-randomizer`, wird automatisch angelegt).
  - Beide Wege erzeugen bei gleichem Seed und gleicher Basis-ROM bytegleiche ROMs. Gespeichert wird nur ein BPS-Patch (ca. 100–200 KB).
- **Grafiken** (Karte, Pokémon-Icons Gen 4 und 5) werden aus der ROM des Users erzeugt und nur lokal zwischengespeichert.

## Backend selbst hosten (`deploy/`)

Schlanker Supabase-kompatibler Stack: Postgres 16, GoTrue (Auth), PostgREST, Realtime, Caddy (TLS), App. Er braucht zusammen etwa 1 GB RAM.

1. DNS: `SITE_DOMAIN` und `API_DOMAIN` auf den Server zeigen lassen.
2. `cd deploy && cp .env.example .env`, dann `node make-keys.mjs` ausführen und die Werte in `.env` eintragen. Dazu die Domains und die SMTP-Daten für Bestätigungsmails.
3. `docker compose up -d db auth rest realtime`
4. Sobald `docker compose logs auth` „migrations applied“ meldet, das App-Schema einspielen:
   `docker compose exec -T db psql -U postgres -d challengemon < ../supabase/migrations/0001_challengemon.sql`
5. `docker compose up -d --build app caddy`

Die App läuft alternativ auch auf Vercel. Dann `NEXT_PUBLIC_SUPABASE_URL=https://<API_DOMAIN>` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` setzen und `app` aus dem Compose weglassen.

## Optionale Integrationen

| Variable | Zweck | Einrichtung |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Drive | Google Cloud Console: OAuth-Client „Webanwendung“, Origin = Seite, Scope `drive.file`, Drive API aktivieren |
| `NEXT_PUBLIC_DROPBOX_APP_KEY` | Dropbox | Dropbox App Console: App-Ordner-Zugriff, Redirect `https://<SITE_DOMAIN>/speicher/dropbox`, Permissions `files.content.read/write`, PKCE |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | Online-Randomizer | GitHub OAuth App mit aktiviertem Device Flow. Ohne diese Variable können User einen Personal Access Token eintragen |
| `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_OPERATOR_ADDRESS`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_HOSTING_NOTE` | Datenschutzerklärung | |

## Randomizer-Dateien

`public/randomizer/` enthält den unveränderten `PokeRandoZX.jar` (GPL-3.0), den Starter `SeededRandomizer.java` und dessen kompiliertes `seeded.jar`, den Action-Workflow und das Action-Skript. `bps.mjs` wird bei `npm run build` aus `lib/rom/bps.ts` erzeugt.

`seeded.jar` neu bauen (Java 17):

```
javac --release 17 -cp public/randomizer/PokeRandoZX.jar -d /tmp/seeded public/randomizer/SeededRandomizer.java
jar cf public/randomizer/seeded.jar -C /tmp/seeded SeededRandomizer.class
```

## Entwicklung

```
npm install
cp .env.example .env.local
npm run dev
```

## Controller (DualShock)

| DualShock | DS |
|---|---|
| Kreis / Kreuz | A / B |
| Dreieck / Viereck | X / Y |
| L1 / R1 | L / R |
| Options / Share | Start / Select |
| D-Pad / linker Stick | Steuerkreuz |
| Rechter Stick + R3 | Touch-Cursor bewegen + tippen |
| R2 | Vorspulen |
| Touchpad gedrückt halten | Speichern & Beenden |

Tastatur: Pfeiltasten, X = B, Z = A, S = Y, A = X, Q/E = L/R, Enter = Start, V = Select, Leertaste = Vorspulen.
