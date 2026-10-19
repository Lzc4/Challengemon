import Link from "next/link";

export default function LegalFooter() {
  return (
    <footer className="legal-footer small muted">
      <span>
        Challengemon ist ein privates Fanprojekt ohne Verbindung zu Nintendo, Game Freak, Creatures oder The Pokémon Company. Alle Marken gehören ihren
        Inhabern. Wir stellen keine Spiele bereit.
      </span>
      <span className="legal-links">
        <Link href="/rechtliches/nutzungsbedingungen">Nutzungsbedingungen</Link>
        <Link href="/rechtliches/datenschutz">Datenschutz</Link>
        <Link href="/rechtliches/lizenzen">Lizenzen</Link>
        <Link href="/changelog">Changelog</Link>
      </span>
    </footer>
  );
}
