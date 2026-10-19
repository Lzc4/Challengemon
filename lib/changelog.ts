export type ChangeKind = "neu" | "besser" | "fix";

export interface Release {
  version: string;
  date: string;
  title: string;
  changes: { kind: ChangeKind; text: string }[];
}

export const CHANGELOG: Release[] = [
  {
    version: "1.0",
    date: "2026-10-19",
    title: "Challengemon",
    changes: [
      { kind: "neu", text: "Eigene Bibliothek: Jeder bringt seine eigenen Spiele mit, gespeichert im eigenen Speicher (Gerät, Google Drive, Dropbox, S3 oder WebDAV)" },
      { kind: "neu", text: "Randomizer direkt im Browser oder im eigenen GitHub-Account, wahlweise gleiche ROM für alle oder eigene ROM pro Spieler" },
      { kind: "neu", text: "Randomisierte Runs speichern nur einen kleinen Patch, die ROM wird lokal zusammengebaut" },
      { kind: "neu", text: "Runs mit Einladungslink, Chat pro Run" },
      { kind: "neu", text: "Karten und Pokémon-Icons werden aus deiner eigenen ROM erzeugt, auch für Gen 5" },
      { kind: "neu", text: "Live-Team, Karte, Tracker, Level-Caps, Battlecam und Overlay aus Gen 4 und 5" },
    ],
  },
];
