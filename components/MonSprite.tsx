"use client";

import PokeIcon from "./PokeIcon";
import { useGameAssets } from "@/lib/rom/assets";
import type { Gen4Game } from "@/lib/save/gen4";

export default function MonSprite({
  species,
  isEgg,
  size = 56,
  fainted,
  title,
  game,
}: {
  species: number;
  isEgg?: boolean;
  size?: number;
  fainted?: boolean;
  title?: string;
  game: Gen4Game | null;
}) {
  const { iconsUrl } = useGameAssets(game);
  return (
    <span className={`mon-sprite${fainted ? " fainted" : ""}`} title={title} style={{ width: size, height: size }}>
      <PokeIcon species={species} isEgg={isEgg} iconsUrl={iconsUrl} scale={size / 32} animate={false} />
    </span>
  );
}
