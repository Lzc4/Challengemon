import LegalPage, { OPERATOR } from "@/components/LegalPage";

export const metadata = { title: "Nutzungsbedingungen · Challengemon" };

export default function TermsPage() {
  return (
    <LegalPage title="Nutzungsbedingungen" updated="20.10.2026">
      <h2>1. Worum es geht</h2>
      <p>
        Challengemon ist ein kostenloses, nicht-kommerzielles Fanprojekt{OPERATOR.name ? ` von ${OPERATOR.name}` : ""}. Die Seite hilft dir, Nuzlocke-
        und Soullocke-Runs allein oder mit Freunden zu organisieren: mit Tracker, Live-Team, Karte, Chat und einem Emulator, der vollständig in
        deinem Browser läuft.
      </p>
      <p>
        <strong>Challengemon stellt keine Spiele bereit.</strong> Wir verbreiten oder verlinken keine ROMs und helfen nicht dabei, welche zu
        beschaffen. Die Challengemon-Cloud (siehe unten) ist ein privater Ablageplatz für deine eigene Sicherungskopie, kein Download-Angebot.
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
          Drive, deiner Nextcloud, deinem S3-Bucket oder deinem WebDAV-Server. Die Übertragung läuft direkt zwischen deinem Browser und diesem
          Speicher. Für ihn gelten die Bedingungen des jeweiligen Anbieters.
        </li>
        <li>
          Oder du nutzt die <strong>Challengemon-Cloud</strong>: Dann liegen deine Sicherungskopie von einem Spiel sowie deine Randomizer-Patches und
          Spielstände auf unserem Server. Nur du kommst mit deinem Konto an diese Dateien, auch Mitspieler nicht. Der Platz ist begrenzt (ein Spiel,
          dazu ein festes Kontingent für Spielstände).
        </li>
        <li>
          Für alle anderen Speicher kennt unser Server nur Verwaltungsdaten: Dateiname, Größe, Prüfsumme und den Speicherort, damit deine Runs auf
          allen deinen Geräten funktionieren.
        </li>
        <li>
          Erhalten wir einen begründeten Hinweis, dass eine Datei in der Challengemon-Cloud Rechte verletzt, oder verstößt du gegen diese
          Bedingungen, dürfen wir die Datei löschen und das Konto sperren.
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

      <h2>4. Einladungen</h2>
      <p>
        Challengemon ist derzeit nur auf Einladung nutzbar. Jeder Einladungscode gilt für genau ein Konto. Lade nur Leute ein, die du kennst. Wer
        Codes öffentlich verteilt oder verkauft, kann gesperrt werden.
      </p>

      <h2>5. Fairer Umgang</h2>
      <ul>
        <li>Keine rechtswidrigen, beleidigenden oder belästigenden Inhalte im Chat, in Run-Namen oder im Anzeigenamen.</li>
        <li>Keine Weitergabe oder Anfrage von ROMs oder Links dazu.</li>
        <li>Keine Versuche, die Seite zu stören, fremde Daten abzurufen oder Sicherheitsmechanismen zu umgehen.</li>
      </ul>
      <p>Bei Verstößen können wir Inhalte entfernen und Konten sperren oder löschen.</p>

      <h2>6. Verfügbarkeit und Haftung</h2>
      <p>
        Challengemon wird in der Freizeit betrieben, ohne Gewähr für Verfügbarkeit oder Fehlerfreiheit. Das gilt auch für die
        Challengemon-Cloud: Sie ist kein Backup. Sichere deine Spielstände selbst, zum Beispiel über den .sav-Download. Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder
        Gesundheit. Im Übrigen ist die Haftung ausgeschlossen, soweit das gesetzlich zulässig ist.
      </p>

      <h2>7. Konto</h2>
      <p>
        Du kannst dein Konto jederzeit in den Kontoeinstellungen löschen. Alles in deiner Challengemon-Cloud wird dabei mitgelöscht. Deine Dateien in
        deinem eigenen Speicher bleiben unberührt, die löschst du dort selbst.
      </p>

      <h2>8. Marken</h2>
      <p>
        Pokémon und alle damit verbundenen Namen sind Marken von Nintendo, Creatures Inc., Game Freak und The Pokémon Company. Challengemon steht in
        keiner Verbindung zu diesen Unternehmen und wird von ihnen weder unterstützt noch geprüft. Spielnamen werden nur verwendet, um zu
        beschreiben, mit welchen Spielen die Seite umgehen kann.
      </p>

      <h2>9. Hinweise auf Rechtsverletzungen</h2>
      <p>
        Wenn du glaubst, dass über Challengemon Rechte verletzt werden, melde dich{OPERATOR.email ? ` unter ${OPERATOR.email}` : ""}. Wir prüfen jede
        Meldung zügig.
      </p>

      <h2>10. Änderungen</h2>
      <p>
        Wir können diese Bedingungen anpassen, wenn sich die Seite oder die Rechtslage ändert. Die jeweils aktuelle Fassung steht auf dieser Seite.
      </p>
    </LegalPage>
  );
}
