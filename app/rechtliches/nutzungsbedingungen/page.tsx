import LegalPage, { OPERATOR } from "@/components/LegalPage";

export const metadata = { title: "Nutzungsbedingungen · Challengemon" };

export default function TermsPage() {
  return (
    <LegalPage title="Nutzungsbedingungen" updated="19.10.2026">
      <h2>1. Worum es geht</h2>
      <p>
        Challengemon ist ein kostenloses, nicht-kommerzielles Fanprojekt{OPERATOR.name ? ` von ${OPERATOR.name}` : ""}. Die Seite hilft dir, Nuzlocke-
        und Soullocke-Runs allein oder mit Freunden zu organisieren: mit Tracker, Live-Team, Karte, Chat und einem Emulator, der vollständig in
        deinem Browser läuft.
      </p>
      <p>
        <strong>Challengemon stellt keine Spiele bereit.</strong> Wir hosten, verbreiten oder verlinken keine ROMs und helfen nicht dabei, welche zu
        beschaffen.
      </p>

      <h2>2. Deine Dateien, deine Verantwortung</h2>
      <ul>
        <li>Du darfst nur Sicherungskopien von Spielen verwenden, deren Original du selbst besitzt und die du selbst erstellt hast.</li>
        <li>
          Du bestätigst das beim Hinzufügen jeder Datei. Für die Rechtmäßigkeit deiner Dateien bist allein du verantwortlich. Das gilt auch
          gegenüber den Rechteinhabern.
        </li>
        <li>
          Deine Dateien (ROMs, Randomizer-Patches, Spielstände) liegen in dem Speicher, den du selbst auswählst: in deinem Browser, deinem Google
          Drive, deiner Dropbox, deinem S3-Bucket oder deinem WebDAV-Server. Die Übertragung läuft direkt zwischen deinem Browser und diesem
          Speicher. Für ihn gelten die Bedingungen des jeweiligen Anbieters.
        </li>
        <li>
          Unser Server speichert keine Spieldateien, sondern nur Verwaltungsdaten: Dateiname, Größe, Prüfsumme und den Speicherort, damit deine Runs
          auf allen deinen Geräten funktionieren.
        </li>
        <li>Du gibst deine Dateien nicht an andere weiter, auch nicht an Mitspieler, auch nicht per Chat oder Link.</li>
      </ul>

      <h2>3. Randomizer</h2>
      <p>
        Der Randomizer (Universal Pokemon Randomizer ZX, GPL-3.0) läuft entweder in deinem Browser oder in einem privaten Repository in deinem
        eigenen GitHub-Account. Im zweiten Fall gelten zusätzlich die Bedingungen von GitHub, und du bist für die Nutzung deines Accounts
        verantwortlich. Bei „gleicher ROM für alle“ teilen sich die Mitspieler nur die Einstellungen und den Seed. Jeder erzeugt seine ROM aus seiner
        eigenen Datei.
      </p>

      <h2>4. Fairer Umgang</h2>
      <ul>
        <li>Keine rechtswidrigen, beleidigenden oder belästigenden Inhalte im Chat, in Run-Namen oder im Anzeigenamen.</li>
        <li>Keine Weitergabe oder Anfrage von ROMs oder Links dazu.</li>
        <li>Keine Versuche, die Seite zu stören, fremde Daten abzurufen oder Sicherheitsmechanismen zu umgehen.</li>
      </ul>
      <p>Bei Verstößen können wir Inhalte entfernen und Konten sperren oder löschen.</p>

      <h2>5. Verfügbarkeit und Haftung</h2>
      <p>
        Challengemon wird in der Freizeit betrieben, ohne Gewähr für Verfügbarkeit oder Fehlerfreiheit. Sichere deine Spielstände selbst, zum
        Beispiel über den .sav-Download. Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder
        Gesundheit. Im Übrigen ist die Haftung ausgeschlossen, soweit das gesetzlich zulässig ist.
      </p>

      <h2>6. Konto</h2>
      <p>
        Du kannst dein Konto jederzeit in den Kontoeinstellungen löschen. Deine Dateien in deinem eigenen Speicher bleiben davon unberührt. Die
        löschst du dort selbst.
      </p>

      <h2>7. Marken</h2>
      <p>
        Pokémon und alle damit verbundenen Namen sind Marken von Nintendo, Creatures Inc., Game Freak und The Pokémon Company. Challengemon steht in
        keiner Verbindung zu diesen Unternehmen und wird von ihnen weder unterstützt noch geprüft. Spielnamen werden nur verwendet, um zu
        beschreiben, mit welchen Spielen die Seite umgehen kann.
      </p>

      <h2>8. Hinweise auf Rechtsverletzungen</h2>
      <p>
        Wenn du glaubst, dass über Challengemon Rechte verletzt werden, melde dich{OPERATOR.email ? ` unter ${OPERATOR.email}` : ""}. Wir prüfen jede
        Meldung zügig.
      </p>

      <h2>9. Änderungen</h2>
      <p>
        Wir können diese Bedingungen anpassen, wenn sich die Seite oder die Rechtslage ändert. Die jeweils aktuelle Fassung steht auf dieser Seite.
      </p>
    </LegalPage>
  );
}
