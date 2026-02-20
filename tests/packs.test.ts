import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { PackManifest, PeonConfig, PeonState } from "../src/types";
import { loadManifest, pickSound } from "../src/packs";

describe("loadManifest", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `peon-ping-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads openpeon.json manifest", () => {
    const manifest: PackManifest = {
      name: "test-pack",
      display_name: "Test Pack",
      categories: {
        "session.start": {
          sounds: [{ file: "hello.wav", label: "Hello" }],
        },
      },
    };

    writeFileSync(join(tempDir, "openpeon.json"), JSON.stringify(manifest));
    const result = loadManifest(tempDir);

    expect(result).not.toBeNull();
    expect(result!.name).toBe("test-pack");
    expect(result!.display_name).toBe("Test Pack");
    expect(result!.categories["session.start"].sounds).toHaveLength(1);
  });

  it("loads manifest.json as fallback", () => {
    const manifest: PackManifest = {
      name: "fallback-pack",
      categories: {
        "task.complete": {
          sounds: [{ file: "done.wav" }],
        },
      },
    };

    writeFileSync(join(tempDir, "manifest.json"), JSON.stringify(manifest));
    const result = loadManifest(tempDir);

    expect(result).not.toBeNull();
    expect(result!.name).toBe("fallback-pack");
  });

  it("returns null for directory without manifest", () => {
    const result = loadManifest(tempDir);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    writeFileSync(join(tempDir, "openpeon.json"), "not json");
    const result = loadManifest(tempDir);
    expect(result).toBeNull();
  });
});

describe("pickSound", () => {
  let tempDir: string;
  let packDir: string;
  let soundsDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `peon-ping-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    packDir = join(tempDir, "packs", "test-pack");
    soundsDir = join(packDir, "sounds");
    mkdirSync(soundsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null for disabled category", () => {
    const config: PeonConfig = {
      active_pack: "test-pack",
      volume: 0.5,
      enabled: true,
      categories: { "session.start": false },
      annoyed_threshold: 3,
      annoyed_window_seconds: 10,
    };
    const state: PeonState = {
      paused: false,
      last_played: {},
      prompt_timestamps: [],
      last_stop_time: 0,
      session_start_time: 0,
    };

    const result = pickSound("session.start", config, state);
    expect(result).toBeNull();
  });
});
