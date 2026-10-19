"use client";

import { useMemo } from "react";
import { GEOMETRY, allPoints, mapInfo, unovaEdges } from "@/lib/save/maps";
import type { Gen4Game } from "@/lib/save/gen4";
import sinnohTowns from "@/lib/data/sinnoh_towns.json";

const SINNOH_TOWNS = sinnohTowns as {
  key: string;
  town: boolean;
  blocks: [number, number][];
}[];

function SinnohTowns({ geo }: { geo: (typeof GEOMETRY)["pt"] }) {
  return (
    <svg
      className="pgmap-towns"
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {SINNOH_TOWNS.map((t) => (
        <g key={t.key}>
          {t.blocks.map(([bx, bz]) => {
            const c = geo.pixel(bx, bz);
            return (
              <rect
                key={`o${bx}-${bz}`}
                x={c.x - 4.5}
                y={c.y - 4.5}
                width={9}
                height={9}
                fill="#182030"
              />
            );
          })}
          {t.blocks.map(([bx, bz]) => {
            const c = geo.pixel(bx, bz);
            return (
              <rect
                key={`f${bx}-${bz}`}
                x={c.x - 3.5}
                y={c.y - 3.5}
                width={7}
                height={7}
                fill={t.town ? "#58a8f8" : "#f86048"}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}

const UNOVA_LAND =
  "2,2 99,2 99,36 93,38 92,44 99,48 99,97 64,97 58,91 50,91 48,95 40,95 38,89 36,79 32,68 26,62 16,62 14,68 30,71 32,79 26,87 20,97 2,97";

function UnovaMap({
  game,
  placed,
}: {
  game: "bw" | "b2w2";
  placed: { id: string; color: string; name: string; info: ReturnType<typeof mapInfo> }[];
}) {
  const points = useMemo(() => allPoints(game), [game]);
  const edges = useMemo(() => unovaEdges(game), [game]);
  const here = new Set(placed.map((p) => p.info?.mapsec));
  return (
    <svg viewBox="0 0 102 100" role="img" aria-label="Karte von Einall">
      <polygon points={UNOVA_LAND} className="tm-johto" />
      {edges.map(([a, b], i) => (
        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="tm-road" />
      ))}
      {points.map((pt) =>
        pt.town ? (
          <rect
            key={pt.mapsec}
            x={pt.x - 2}
            y={pt.y - 2}
            width="4"
            height="4"
            rx="0.6"
            className={`tm-town${here.has(pt.mapsec) ? " on" : ""}`}
          >
            <title>{pt.name}</title>
          </rect>
        ) : (
          <circle
            key={pt.mapsec}
            cx={pt.x}
            cy={pt.y}
            r="1.1"
            className={`tm-route${here.has(pt.mapsec) ? " on" : ""}`}
          >
            <title>{pt.name}</title>
          </circle>
        ),
      )}
      {placed.map((p, i) =>
        p.info?.point ? (
          <circle
            key={p.id}
            cx={p.info.point.x + i * 1.5}
            cy={p.info.point.y - i * 1.5}
            r="2.4"
            fill={p.color}
            stroke="#fff"
            strokeWidth="0.6"
          >
            <title>{`${p.name}: ${placeLabel(p.info)}`}</title>
          </circle>
        ) : null,
      )}
    </svg>
  );
}

export interface MapPlayer {
  id: string;
  name: string;
  mapId: number | null;
  posX?: number | null;
  posY?: number | null;
  color: string;
}

export const PLAYER_COLORS = ["#f85838", "#3890f8", "#48d058", "#d070f0"];

function placeLabel(info: ReturnType<typeof mapInfo>) {
  if (!info) return "unbekannt";
  return `${info.name}${info.type === 4 || info.type === 5 ? " (drinnen)" : ""}`;
}

export default function TownMap({
  players,
  mapUrl,
  compact,
  game,
}: {
  players: MapPlayer[];
  mapUrl: string | null;
  compact?: boolean;
  game: Gen4Game;
}) {
  const points = useMemo(() => allPoints(game), [game]);
  const geo = GEOMETRY[game];
  const placed = players.map((p) => ({
    ...p,
    info: mapInfo(game, p.mapId, p.posX, p.posY),
  }));

  return (
    <div className={`townmap${compact ? " compact" : ""}`}>
      {mapUrl ? (
        <div
          className={`pgmap ${game}`}
          style={{
            backgroundImage: `url(${mapUrl})`,
            aspectRatio: `${geo.width} / ${geo.height}`,
          }}
        >
          {game !== "hgss" && <SinnohTowns geo={geo} />}
          {placed.map((p, i) => {
            if (!p.info?.point) return null;
            const px = geo.pixel(p.info.point.x, p.info.point.y);
            return (
              <span
                key={p.id}
                className="pgmap-pin"
                title={`${p.name}: ${placeLabel(p.info)}`}
                style={
                  {
                    left: `${((px.x + i * 3) / geo.width) * 100}%`,
                    top: `${((px.y - i * 3) / geo.height) * 100}%`,
                    "--c": p.color,
                    animationDelay: `${i * 0.25}s`,
                  } as React.CSSProperties
                }
              >
                {p.name.slice(0, 1).toUpperCase()}
              </span>
            );
          })}
        </div>
      ) : game === "bw" || game === "b2w2" ? (
        <UnovaMap game={game} placed={placed} />
      ) : (
        <svg
          viewBox={`${geo.view.x} ${geo.view.y} ${geo.view.w} ${geo.view.h}`}
          role="img"
          aria-label={
            game !== "hgss" ? "Karte von Sinnoh" : "Karte von Johto und Kanto"
          }
        >
          {game !== "hgss" ? (
            <rect
              x={geo.view.x}
              y={geo.view.y}
              width={geo.view.w}
              height={geo.view.h}
              className="tm-johto"
            />
          ) : (
            <>
              <rect
                x="0"
                y="-1"
                width="26.5"
                height="18"
                className="tm-johto"
              />
              <rect
                x="26.5"
                y="-1"
                width="20.5"
                height="18"
                className="tm-kanto"
              />
            </>
          )}
          {points.map((pt) =>
            pt.town ? (
              <rect
                key={pt.mapsec}
                x={pt.x - 0.55}
                y={pt.y - 0.55}
                width="1.1"
                height="1.1"
                className="tm-town"
              />
            ) : (
              <circle
                key={pt.mapsec}
                cx={pt.x}
                cy={pt.y}
                r="0.3"
                className="tm-route"
              />
            ),
          )}
          {placed.map((p) =>
            p.info?.point ? (
              <circle
                key={p.id}
                cx={p.info.point.x}
                cy={p.info.point.y}
                r="0.9"
                fill={p.color}
                stroke="#fff"
                strokeWidth="0.2"
              />
            ) : null,
          )}
        </svg>
      )}
      <div className="tm-legend">
        {placed.map((p) => (
          <div key={p.id} className="tm-where">
            <span className="tm-dot" style={{ background: p.color }} />
            <span className="tm-player">{p.name}</span>
            <span className="tm-place">{placeLabel(p.info)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
