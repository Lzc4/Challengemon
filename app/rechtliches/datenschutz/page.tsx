import LegalPage, { OPERATOR } from "@/components/LegalPage";

export const metadata = { title: "Datenschutz · Challengemon" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Datenschutzerklärung" updated="19.10.2026">
      <h2>1. Verantwortlicher</h2>
      <p>
        {OPERATOR.name || "[Name wird ergänzt]"}
        <br />
        {OPERATOR.address || "[Anschrift wird ergänzt]"}
        <br />
        E-Mail: {OPERATOR.email || "[E-Mail wird ergänzt]"}
      </p>

      <h2>2. Das Grundprinzip</h2>
      <p>
        Challengemon ist so gebaut, dass möglichst wenig bei uns landet. Spieldateien, Randomizer-Patches und Spielstände speicherst du in deinem
        eigenen Speicher. Dein Browser überträgt sie direkt dorthin, ohne Umweg über unseren Server. Zugangsdaten zu deinem Speicher und zu GitHub
        bleiben in deinem Browser.
      </p>

      <h2>3. Was wir verarbeiten</h2>
      <ul>
        <li>
          <strong>Konto:</strong> E-Mail-Adresse, Anzeigename, Passwort (nur als Hash) und Zeitpunkte von Registrierung und Login. Zweck:
          Bereitstellung des Kontos (Art. 6 Abs. 1 lit. b DSGVO).
        </li>
        <li>
          <strong>Runs und Tracker:</strong> Run-Einstellungen, Randomizer-Einstellungen und Seeds, Begegnungen, Spielstatus (Team, Ort im Spiel),
          eine Zusammenfassung deines Spielstands (Team, Boxen, Orden, Spielzeit) und Chatnachrichten. Sichtbar nur für die Mitspieler des
          jeweiligen Runs (Art. 6 Abs. 1 lit. b DSGVO).
        </li>
        <li>
          <strong>Verwaltungsdaten deiner Dateien:</strong> Dateiname bzw. Pfad, Größe, Prüfsumme (CRC32), Spielcode und die Art des Speichers. Die
          Dateien selbst erhalten wir nicht.
        </li>
        <li>
          <strong>Server-Logs:</strong> Beim Aufruf der Seite verarbeitet der Hoster technisch notwendig deine IP-Adresse, Zeitpunkt, aufgerufene
          Adresse und Browserkennung. Das dient dem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Die Logs werden nach spätestens 14 Tagen
          gelöscht.
        </li>
      </ul>

      <h2>4. Speicher in deinem Browser</h2>
      <p>
        Wir nutzen Local Storage und IndexedDB für Anmeldung, ROM-Cache, erzeugte Grafiken, Einstellungen und die Zugangsdaten deiner verknüpften
        Dienste. Das ist für die von dir gewünschten Funktionen unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Es gibt kein Tracking, keine
        Werbung und keine Analyse-Cookies. Die Daten löschst du über die Browser-Einstellungen oder durch Trennen des Speichers.
      </p>

      <h2>5. Dienste, mit denen dein Browser direkt spricht</h2>
      <ul>
        <li>
          <strong>EmulatorJS-CDN</strong> (cdn.emulatorjs.org): Laden des Emulators beim Spielen. Dabei wird deine IP-Adresse übertragen.
        </li>
        <li>
          <strong>CheerpJ</strong> (Leaning Technologies Ltd., cjrtnc.leaningtech.com): Java-Laufzeit für den Randomizer im Browser. Wird nur
          geladen, wenn du im Browser randomisierst. Dabei wird deine IP-Adresse übertragen.
        </li>
        <li>
          <strong>Google Drive, Nextcloud, S3- oder WebDAV-Anbieter:</strong> nur wenn du sie selbst verbindest. Es gelten die Datenschutzhinweise
          des jeweiligen Anbieters, mit dem du einen eigenen Vertrag hast.
        </li>
        <li>
          <strong>GitHub:</strong> nur wenn du den Online-Randomizer verbindest. Die Anmeldung wird über unseren Server an GitHub weitergeleitet,
          dein Zugangsschlüssel wird aber nur in deinem Browser gespeichert.
        </li>
        <li>
          <strong>Battlecam:</strong> Das Bild geht per WebRTC direkt zwischen den Mitspielern. Dabei sehen sich die Geräte gegenseitig die
          IP-Adressen. Zum Verbindungsaufbau wird ein STUN-Server von Google angefragt.
        </li>
      </ul>

      <h2>6. Empfänger und Auftragsverarbeiter</h2>
      <p>
        Hosting und Datenbank laufen auf {process.env.NEXT_PUBLIC_HOSTING_NOTE || "[Hoster und Standort werden ergänzt]"}. Mit Dienstleistern, die
        Daten in unserem Auftrag verarbeiten, bestehen Verträge nach Art. 28 DSGVO. Eine Weitergabe an Dritte zu anderen Zwecken findet nicht
        statt.
      </p>

      <h2>7. Speicherdauer</h2>
      <p>
        Kontodaten speichern wir, bis du dein Konto löschst. Run-Daten bleiben erhalten, solange der Run existiert. Wer einen Run verlässt oder sein
        Konto löscht, dessen Daten in diesem Run werden mitgelöscht. Ältere Spielstand-Einträge werden automatisch aufgeräumt.
      </p>

      <h2>8. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21
        DSGVO). Wende dich dafür an die oben genannte Adresse. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum
        Beispiel bei der Behörde deines Bundeslandes.
      </p>
    </LegalPage>
  );
}
