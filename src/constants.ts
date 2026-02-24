import { join } from "node:path";
import { homedir } from "node:os";
import type { PeonConfig, PeonState } from "./types";

export const DATA_DIR = join(homedir(), ".config", "peon-ping");
export const PACKS_DIR = join(DATA_DIR, "packs");
export const CONFIG_PATH = join(DATA_DIR, "config.json");
export const STATE_PATH = join(DATA_DIR, "state.json");

export const LEGACY_PACKS = join(homedir(), ".claude", "hooks", "peon-ping", "packs");

export const DEFAULT_CONFIG: PeonConfig = {
  default_pack: "peon",
  volume: 0.5,
  enabled: true,
  desktop_notifications: true,
  categories: {
    "session.start": true,
    "task.acknowledge": true,
    "task.complete": true,
    "task.error": true,
    "input.required": true,
    "resource.limit": true,
    "user.spam": true,
  },
  annoyed_threshold: 3,
  annoyed_window_seconds: 10,
  silent_window_seconds: 0,
  relay_mode: "auto",
};

export const DEFAULT_STATE: PeonState = {
  paused: false,
  last_played: {},
  prompt_timestamps: [],
  last_stop_time: 0,
  session_start_time: 0,
};

export const CATEGORY_LABELS: Record<string, string> = {
  "session.start": "Session start",
  "task.acknowledge": "Task acknowledge",
  "task.complete": "Task complete",
  "task.error": "Task error",
  "input.required": "Input required",
  "resource.limit": "Resource limit",
  "user.spam": "Rapid prompt spam",
};

export const VOLUME_STEPS = ["10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%"];

export const REGISTRY_URL = "https://peonping.github.io/registry/index.json";
export const DEFAULT_PACK_NAMES = [
  "peon", "peasant", "glados", "sc_kerrigan", "sc_battlecruiser",
  "ra2_kirov", "dota2_axe", "duke_nukem", "tf2_engineer", "hd2_helldiver",
];
export const FALLBACK_REPO = "PeonPing/og-packs";
export const FALLBACK_REF = "v1.1.0";
