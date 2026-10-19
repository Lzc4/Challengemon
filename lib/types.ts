export type System = "nds" | "gba" | "gb" | "gbc";
export type RunMode = "nuzlocke" | "soullocke" | "casual";
export type EncounterStatus = "caught" | "dead" | "missed";

export interface Profile {
  id: string;
  name: string;
}

export type RandomizeMode = "none" | "shared" | "individual";
export type PlayerStatus = "waiting" | "randomizing" | "ready" | "failed";

export interface LibraryRom {
  id: string;
  user_id: string;
  system: System;
  game_code: string | null;
  title: string;
  crc32: number;
  size: number;
  provider: string;
  path: string;
  created_at: string;
}

export interface Run {
  id: string;
  name: string;
  system: System;
  game_code: string;
  mode: RunMode;
  honor_mode: boolean;
  rare_candies: boolean;
  randomize: RandomizeMode;
  settings: string | null;
  settings_name: string | null;
  seed: number | null;
  randomizer_version: string | null;
  invite_code: string;
  max_players: number;
  created_by: string | null;
  created_at: string;
  ended_at: string | null;
  end_reason: string | null;
  result: "won" | "lost" | null;
  ended_by: string | null;
  archived_at: string | null;
}

export interface RunPlayer {
  run_id: string;
  user_id: string;
  seed: number | null;
  status: PlayerStatus;
  error: string | null;
  base_crc32: number | null;
  rom_crc32: number | null;
  patch_provider: string | null;
  patch_path: string | null;
  job: string | null;
  joined_at: string;
}

export interface RunWithRelations extends Run {
  run_players: RunPlayer[];
}

export interface SaveRow {
  id: number;
  run_id: string;
  user_id: string;
  kind: "sram" | "state";
  provider: string;
  path: string;
  size: number | null;
  created_at: string;
}

export interface LiveStatus {
  run_id: string;
  user_id: string;
  party: import("./save/gen4").Mon[];
  map_id: number | null;
  pos_x: number | null;
  pos_y: number | null;
  updated_at: string;
}

export interface Encounter {
  id: string;
  run_id: string;
  user_id: string;
  location: string;
  species: string | null;
  nickname: string | null;
  status: EncounterStatus;
  in_party: boolean;
  pid: number | null;
  created_at: string;
  updated_at: string;
}
