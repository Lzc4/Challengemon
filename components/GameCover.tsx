import { catalogFor, CATALOG } from "@/lib/catalog";

const COLORS: Record<string, [string, string]> = {
  red: ["#c0392b", "#7b1d14"],
  blue: ["#2e6fd1", "#173c78"],
  yellow: ["#e8b923", "#8a6a0c"],
  gold: ["#d4a017", "#6e5208"],
  silver: ["#9aa7b8", "#4d5866"],
  crystal: ["#5fc6e8", "#246b85"],
  ruby: ["#d0343f", "#6a121a"],
  sapphire: ["#2d55c8", "#14286a"],
  firered: ["#e2572b", "#7a2610"],
  leafgreen: ["#4fae3c", "#205a16"],
  emerald: ["#1fa36a", "#0b5534"],
  diamond: ["#7fa7e0", "#2f4f86"],
  pearl: ["#e3a7c2", "#8a4b68"],
  platinum: ["#8c8f99", "#3b3d45"],
  heartgold: ["#e0a526", "#7a4e08"],
  soulsilver: ["#b5c2d1", "#4f5d6e"],
  black: ["#3a3a3f", "#0d0d10"],
  white: ["#e8e8ea", "#9a9aa1"],
  black2: ["#2f3a4a", "#0b1018"],
  white2: ["#f0eee8", "#a8a196"],
};

export function shortTitle(title: string) {
  return title.replace(/^Pokémon\s+/, "");
}

export default function GameCover({ code, id, size = "md" }: { code?: string | null; id?: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const entry = id ? CATALOG.find((g) => g.id === id) : catalogFor(code);
  if (!entry) return <div className={`game-cover ${size} empty`}>?</div>;
  const [a, b] = COLORS[entry.id] ?? ["#445", "#223"];
  const light = entry.id === "white" || entry.id === "white2" || entry.id === "pearl" || entry.id === "soulsilver";
  return (
    <div className={`game-cover ${size} card-cover`} style={{ background: `linear-gradient(145deg, ${a}, ${b})`, color: light ? "#1d2433" : "#fff" }}>
      <span className="cover-gen">Gen {entry.gen}</span>
      <span className="cover-title">{shortTitle(entry.title)}</span>
      <span className="cover-region">{entry.region}</span>
    </div>
  );
}
