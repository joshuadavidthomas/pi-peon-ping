import { describe, it, expect } from "bun:test";
import {
  DEFAULT_CONFIG,
  DEFAULT_STATE,
  CATEGORY_LABELS,
  VOLUME_STEPS,
  DEFAULT_PACK_NAMES,
  DATA_DIR,
  PACKS_DIR,
} from "../src/constants";

describe("constants", () => {
  it("DEFAULT_CONFIG has all required fields", () => {
    expect(DEFAULT_CONFIG.active_pack).toBe("peon");
    expect(DEFAULT_CONFIG.volume).toBe(0.5);
    expect(DEFAULT_CONFIG.enabled).toBe(true);
    expect(DEFAULT_CONFIG.annoyed_threshold).toBe(3);
    expect(DEFAULT_CONFIG.annoyed_window_seconds).toBe(10);
    expect(DEFAULT_CONFIG.relay_mode).toBe("auto");
  });

  it("DEFAULT_CONFIG categories match CATEGORY_LABELS keys", () => {
    const configKeys = Object.keys(DEFAULT_CONFIG.categories).sort();
    const labelKeys = Object.keys(CATEGORY_LABELS).sort();
    expect(configKeys).toEqual(labelKeys);
  });

  it("DEFAULT_STATE has sensible defaults", () => {
    expect(DEFAULT_STATE.paused).toBe(false);
    expect(DEFAULT_STATE.last_played).toEqual({});
    expect(DEFAULT_STATE.prompt_timestamps).toEqual([]);
    expect(DEFAULT_STATE.last_stop_time).toBe(0);
    expect(DEFAULT_STATE.session_start_time).toBe(0);
  });

  it("VOLUME_STEPS are ordered 10% to 100%", () => {
    expect(VOLUME_STEPS).toHaveLength(10);
    expect(VOLUME_STEPS[0]).toBe("10%");
    expect(VOLUME_STEPS[9]).toBe("100%");
  });

  it("DEFAULT_PACK_NAMES includes expected packs", () => {
    expect(DEFAULT_PACK_NAMES).toContain("peon");
    expect(DEFAULT_PACK_NAMES).toContain("glados");
    expect(DEFAULT_PACK_NAMES).toContain("duke_nukem");
    expect(DEFAULT_PACK_NAMES.length).toBeGreaterThanOrEqual(10);
  });

  it("paths end with peon-ping directories", () => {
    expect(DATA_DIR).toMatch(/peon-ping$/);
    expect(PACKS_DIR).toMatch(/peon-ping\/packs$/);
  });
});
