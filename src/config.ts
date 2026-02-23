import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CONFIG_PATH, DATA_DIR, DEFAULT_CONFIG, DEFAULT_STATE, PACKS_DIR, STATE_PATH } from "./constants";
import { DEFAULT_ICON_PATH, installIcon } from "./notification";
import type { PeonConfig, PeonState } from "./types";

const ICON_URL = "https://raw.githubusercontent.com/PeonPing/peon-ping/main/docs/peon-icon.png";

export function ensureDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(PACKS_DIR, { recursive: true });
  ensureDefaultIcon();
  installIcon();
}

function ensureDefaultIcon(): void {
  if (existsSync(DEFAULT_ICON_PATH)) return;
  fetch(ICON_URL, { signal: AbortSignal.timeout(5000) })
    .then((resp) => {
      if (!resp.ok) return;
      return resp.arrayBuffer();
    })
    .then((buf) => {
      if (buf) writeFileSync(DEFAULT_ICON_PATH, Buffer.from(buf));
    })
    .catch(() => {});
}

export function loadConfig(): PeonConfig {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return { ...DEFAULT_CONFIG, ...raw, categories: { ...DEFAULT_CONFIG.categories, ...raw.categories } };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: PeonConfig): void {
  ensureDirs();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export function loadState(): PeonState {
  try {
    const raw = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    return { ...DEFAULT_STATE, ...raw };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: PeonState): void {
  ensureDirs();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}
