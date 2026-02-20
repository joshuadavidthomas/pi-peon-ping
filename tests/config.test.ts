import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// We test the config load/save logic by calling the functions against a temp dir.
// Since the module uses hardcoded paths, we test the serialization logic directly.

describe("config serialization", () => {
  let tempDir: string;
  let configPath: string;
  let statePath: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `peon-ping-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
    configPath = join(tempDir, "config.json");
    statePath = join(tempDir, "state.json");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("round-trips config through JSON", () => {
    const config = {
      active_pack: "glados",
      volume: 0.7,
      enabled: true,
      categories: {
        "session.start": true,
        "task.acknowledge": false,
        "task.complete": true,
        "task.error": true,
        "input.required": true,
        "resource.limit": true,
        "user.spam": false,
      },
      annoyed_threshold: 5,
      annoyed_window_seconds: 15,
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    const loaded = JSON.parse(readFileSync(configPath, "utf8"));

    expect(loaded.active_pack).toBe("glados");
    expect(loaded.volume).toBe(0.7);
    expect(loaded.categories["task.acknowledge"]).toBe(false);
    expect(loaded.annoyed_threshold).toBe(5);
  });

  it("round-trips state through JSON", () => {
    const state = {
      paused: true,
      last_played: { "session.start": "ready.wav" },
      prompt_timestamps: [1000, 2000, 3000],
      last_stop_time: 5000,
      session_start_time: 100,
    };

    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
    const loaded = JSON.parse(readFileSync(statePath, "utf8"));

    expect(loaded.paused).toBe(true);
    expect(loaded.last_played["session.start"]).toBe("ready.wav");
    expect(loaded.prompt_timestamps).toEqual([1000, 2000, 3000]);
  });

  it("merges partial config with defaults", () => {
    const DEFAULT_CONFIG = {
      active_pack: "peon",
      volume: 0.5,
      enabled: true,
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
    };

    const partial = { active_pack: "duke_nukem", categories: { "user.spam": false } };
    writeFileSync(configPath, JSON.stringify(partial));

    const raw = JSON.parse(readFileSync(configPath, "utf8"));
    const merged = {
      ...DEFAULT_CONFIG,
      ...raw,
      categories: { ...DEFAULT_CONFIG.categories, ...raw.categories },
    };

    expect(merged.active_pack).toBe("duke_nukem");
    expect(merged.volume).toBe(0.5); // from default
    expect(merged.categories["user.spam"]).toBe(false); // overridden
    expect(merged.categories["session.start"]).toBe(true); // from default
  });
});
