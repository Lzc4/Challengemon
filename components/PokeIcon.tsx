import { EGG_ICON, ICON_COLS } from "@/lib/rom/hgssAssets";

interface Props {
  species: number;
  isEgg?: boolean;
  iconsUrl: string | null;
  scale?: number;
  animate?: boolean;
}

export default function PokeIcon({ species, isEgg, iconsUrl, scale = 2, animate = true }: Props) {
  const size = 32 * scale;
  if (!iconsUrl) {
    return (
      <span className="pk-icon-fallback" style={{ width: size, height: size, fontSize: Math.max(9, size / 4) }}>
        {isEgg ? "Ei" : `#${species}`}
      </span>
    );
  }
  const index = isEgg ? EGG_ICON : species;
  const col = index % ICON_COLS;
  const row = Math.floor(index / ICON_COLS);
  return (
    <span className="pk-icon" style={{ width: size, height: size }}>
      <span
        className={`pk-icon-strip${animate ? " anim" : ""}`}
        style={
          {
            width: size,
            height: size * 2,
            backgroundImage: `url(${iconsUrl})`,
            backgroundSize: `${ICON_COLS * 32 * scale}px auto`,
            backgroundPosition: `-${col * size}px -${row * size * 2}px`,
            "--h": `${size}px`,
          } as React.CSSProperties
        }
      />
    </span>
  );
}
