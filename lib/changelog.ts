export type ChangeKind = "neu" | "besser" | "fix";

export interface Release {
  version: string;
  date: string;
  title: string;
  changes: { kind: ChangeKind; text: string }[];
}

export const CHANGELOG: Release[] = [
  {
    version: "1.1",
    date: "2026-10-20",
    title: "Professorin Kiesel",
    changes: [
      { kind: "neu", text: "Tutorial beim ersten Login mit Professorin Kiesel und Starter-Wahl für deinen Speicher" },
      { kind: "neu", text: "Login und Registrierung als Gespräch, das normale Formular gibt es weiterhin" },
      { kind: "neu", text: "Rivale Lzc4 mischt mit" },
      { kind: "neu", text: "Nextcloud als Speicher mit Login per Klick (braucht die App WebAppPassword)" },
      { kind: "neu", text: "Challengemon-Cloud: ein Spiel und deine Spielstände direkt bei uns, sofort auf jedem Gerät" },
      { kind: "besser", text: "Spiele in der Challengemon-Cloud werden gepackt gespeichert, Hoch- und Runterladen geht etwa doppelt so schnell" },
      { kind: "neu", text: "Registrierung nur mit Einladung, jeder kann unter Konto selbst Codes verteilen" },
      { kind: "besser", text: "Pixel-Schrift auf der ganzen Seite und Sounds für die Textboxen" },
      { kind: "besser", text: "Dropbox entfernt" },
    ],
  },
  {
    version: "1.0",
    date: "2026-10-19",
    title: "Challengemon",
    changes: [
      { kind: "neu", text: "Eigene Bibliothek: Jeder bringt seine eigenen Spiele mit, gespeichert im eigenen Speicher (Gerät, Google Drive, S3 oder WebDAV)" },
      { kind: "neu", text: "Randomizer direkt im Browser oder im eigenen GitHub-Account, wahlweise gleiche ROM für alle oder eigene ROM pro Spieler" },
      { kind: "neu", text: "Randomisierte Runs speichern nur einen kleinen Patch, die ROM wird lokal zusammengebaut" },
      { kind: "neu", text: "Runs mit Einladungslink, Chat pro Run" },
      { kind: "neu", text: "Karten und Pokémon-Icons werden aus deiner eigenen ROM erzeugt, auch für Gen 5" },
      { kind: "neu", text: "Live-Team, Karte, Tracker, Level-Caps, Battlecam und Overlay aus Gen 4 und 5" },
    ],
  },
];
