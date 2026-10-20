import type { Sprite } from "./sprites";

export default function PixelSprite({ sprite, scale = 4, className }: { sprite: Sprite; scale?: number; className?: string }) {
  const w = sprite.rows[0].length;
  const h = sprite.rows.length;
  const rects: React.ReactNode[] = [];
  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < w) {
      const c = row[x];
      if (c === ".") {
        x++;
        continue;
      }
      // gleiche farben in einer zeile zusammenfassen, spart ne menge rects
      let run = 1;
      while (x + run < w && row[x + run] === c) run++;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={sprite.palette[c] ?? "#f0f"} />);
      x += run;
    }
  });
  return (
    <svg className={className} width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden>
      {rects}
    </svg>
  );
}
