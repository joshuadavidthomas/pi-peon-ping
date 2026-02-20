import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CONFIG_PATH, DATA_DIR, DEFAULT_CONFIG, DEFAULT_STATE, PACKS_DIR, STATE_PATH } from "./constants";
import type { PeonConfig, PeonState } from "./types";

export function ensureDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(PACKS_DIR, { recursive: true });
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
