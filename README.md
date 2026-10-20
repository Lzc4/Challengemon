# Challengemon

Nuzlocke- und Soullocke-Runs im Browser. Jeder bringt seine eigenen Spiele mit. Registrierung nur mit Einladung.

## Prinzip

- **ROMs, Randomizer-Patches und Spielstände** liegen entweder in der **Challengemon-Cloud** (auf dem Server, pro User ein Spiel und 256 MB für Spielstände) oder im Speicher des Users: Browser (IndexedDB), Google Drive, Nextcloud, S3-kompatibel oder WebDAV. Bei eigenem Speicher spricht der Browser direkt mit dem Anbieter, Zugangsdaten bleiben im Browser.
- **Der Server** speichert Konten, Runs, Tracker, Chat, Live-Status, Verwaltungsdaten (Dateiname, Größe, CRC32), Einladungen und die Dateien der Challengemon-Cloud.
- **Randomizer:** Universal Pokemon Randomizer ZX 4.6.1 mit festem Seed.
  - Im Browser über CheerpJ (15–60 s je nach Spiel).
  - Oder als GitHub Action in einem privaten Repo im Account des Users (`challengemon-randomizer`, wird automatisch angelegt).
  - Beide Wege erzeugen bei gleichem Seed und gleicher Basis-ROM bytegleiche ROMs. Gespeichert wird nur ein BPS-Patch (ca. 100–200 KB).
- **Grafiken** (Karte, Pokémon-Icons Gen 4 und 5) werden aus der ROM des Users erzeugt und nur lokal zwischengespeichert.

## Selbst hosten (`deploy/`)

Postgres 16, GoTrue (Auth), PostgREST, Realtime, die App und ein interner Caddy, alles per Docker Compose. Zusammen etwa 1 GB RAM, mit Speicherlimits pro Container. Alles läuft unter einer Domain: `/auth/v1`, `/rest/v1` und `/realtime/v1` sind das Backend, `/` ist die App.

Caddy lauscht nur auf `127.0.0.1:8090`. TLS macht ein vorhandener nginx mit certbot davor (`deploy/nginx-challengemon.conf`).

1. A-Record für die Domain auf den Server zeigen lassen.
2. `cd deploy && cp .env.example .env`, dann `node make-keys.mjs` ausführen und die Werte in `.env` eintragen. Dazu `SITE_DOMAIN` und die SMTP-Daten.
3. `docker compose up -d db auth rest realtime`
4. Sobald `docker compose logs auth` „migrations applied“ meldet, das Schema einspielen:
   `for f in ../supabase/migrations/*.sql; do docker compose exec -T db psql -U postgres -d challengemon < $f; done`
   Danach `docker compose restart rest`, damit PostgREST die neuen Funktionen kennt.
5. `docker compose up -d --build app caddy`
6. `nginx-challengemon.conf` nach `/etc/nginx/sites-available/` kopieren und aktivieren, `nginx -t && systemctl reload nginx`, danach `certbot --nginx -d <domain>`.

## Optionale Integrationen

| Variable | Zweck | Einrichtung |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Drive | Google Cloud Console: OAuth-Client „Webanwendung“, Origin = Seite, Scope `drive.file`, Drive API aktivieren |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | Online-Randomizer | GitHub OAuth App mit aktiviertem Device Flow. Ohne diese Variable können User einen Personal Access Token eintragen |
| `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_OPERATOR_ADDRESS`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_HOSTING_NOTE` | Datenschutzerklärung | |

## Einladungen

Solange `invite_only` an ist, geht Registrieren nur mit Code. Jeder User kann 3 Codes erstellen (Konto → Einladungen), Admins beliebig viele. Einstellungen und Admin setzen:

```
docker compose exec -T db psql -U postgres -d challengemon <<'SQL'
update public.profiles set is_admin = true where id = (select id from auth.users where email = 'du@example.de');
update public.app_settings set value = '5' where key = 'invites_per_user';
update public.app_settings set value = 'false' where key = 'invite_only';  -- registrierung fuer alle offen
SQL
```

Erster Code ohne Admin: `insert into public.invites (code) values ('START-12345');`

## Challengemon-Cloud

Dateien liegen im Docker-Volume `cloud` unter `/data/cloud/<user-id>/`. Die App prüft das Supabase-Token selbst (`JWT_SECRET`). Grenzen per `.env`: `CLOUD_ROM_SLOTS` (Standard 1), `CLOUD_DATA_MAX_MB` (Standard 256). nginx braucht für `/api/cloud/` ein höheres `client_max_body_size`, siehe `nginx-challengemon.conf`.

## Nextcloud

Braucht keine Einrichtung auf unserer Seite. Der User installiert in seiner Nextcloud (ab Version 32) die App [WebAppPassword](https://apps.nextcloud.com/apps/webapppassword) und trägt die Seite als WebDAV-Origin ein. Login läuft per Popup auf der Nextcloud, die App schickt ein 24 h gültiges Token per `postMessage` zurück und setzt CORS für WebDAV. Unser Server ist daran nicht beteiligt.

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
