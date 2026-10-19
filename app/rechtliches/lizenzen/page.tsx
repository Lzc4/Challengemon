import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Lizenzen · Challengemon" };

const COMPONENTS = [
  { name: "EmulatorJS 4.2.3", license: "GPL-3.0", url: "https://github.com/EmulatorJS/EmulatorJS", note: "Emulator-Oberfläche, wird vom CDN geladen" },
  { name: "melonDS (libretro-Core)", license: "GPL-3.0", url: "https://github.com/libretro/melonDS", note: "Nintendo-DS-Emulation" },
  { name: "mGBA (libretro-Core)", license: "MPL-2.0", url: "https://github.com/libretro/mgba", note: "Game-Boy-Advance-Emulation" },
  { name: "Gambatte (libretro-Core)", license: "GPL-2.0", url: "https://github.com/libretro/gambatte-libretro", note: "Game-Boy-Emulation" },
  {
    name: "Universal Pokemon Randomizer ZX 4.6.1",
    license: "GPL-3.0",
    url: "https://github.com/Ajarmar/universal-pokemon-randomizer-zx",
    note: "Randomizer, unverändert mitgeliefert unter /randomizer/PokeRandoZX.jar",
  },
  {
    name: "SeededRandomizer (Challengemon)",
    license: "GPL-3.0",
    url: "/randomizer/SeededRandomizer.java",
    note: "Kleiner Starter, der den Randomizer mit festem Seed aufruft, Quelltext hier",
  },
  { name: "CheerpJ 4", license: "Community License (Leaning Technologies)", url: "https://cheerpj.com/docs/licensing", note: "Java-Laufzeit im Browser, vom Hersteller-CDN geladen" },
  { name: "Next.js", license: "MIT", url: "https://github.com/vercel/next.js", note: "" },
  { name: "React", license: "MIT", url: "https://github.com/facebook/react", note: "" },
  { name: "supabase-js", license: "MIT", url: "https://github.com/supabase/supabase-js", note: "" },
  { name: "aws4fetch", license: "MIT", url: "https://github.com/mhart/aws4fetch", note: "" },
  { name: "Pixelify Sans", license: "SIL Open Font License 1.1", url: "https://fonts.google.com/specimen/Pixelify+Sans", note: "Schriftart" },
];

export default function LicensesPage() {
  return (
    <LegalPage title="Lizenzen" updated="19.10.2026">
      <p>Challengemon baut auf diesen Open-Source-Projekten auf. Vielen Dank an alle, die daran mitarbeiten.</p>
      <ul>
        {COMPONENTS.map((c) => (
          <li key={c.name}>
            <a href={c.url} target="_blank" rel="noreferrer">
              {c.name}
            </a>{" "}
            · {c.license}
            {c.note ? ` · ${c.note}` : ""}
          </li>
        ))}
      </ul>
      <p className="small muted">
        Die GPL-lizenzierten Komponenten werden unverändert genutzt. Ihr Quelltext ist unter den angegebenen Adressen verfügbar. Pokémon-Icons und
        Karten, die du in Challengemon siehst, werden zur Laufzeit aus deiner eigenen Spieldatei erzeugt und sind nicht Teil dieser Seite.
      </p>
    </LegalPage>
  );
}
