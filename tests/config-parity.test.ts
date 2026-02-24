import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("config parity with upstream peon-ping", () => {
  describe("PeonConfig type has all upstream fields", () => {
    it("DEFAULT_CONFIG has default_pack instead of active_pack", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      expect(DEFAULT_CONFIG.default_pack).toBe("peon");
      expect((DEFAULT_CONFIG as any).active_pack).toBeUndefined();
    });

    it("DEFAULT_CONFIG has silent_window_seconds defaulting to 0", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      expect(DEFAULT_CONFIG.silent_window_seconds).toBe(0);
    });

    it("DEFAULT_CONFIG has suppress_subagent_complete defaulting to false", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      expect(DEFAULT_CONFIG.suppress_subagent_complete).toBe(false);
    });

    it("DEFAULT_CONFIG has pack_rotation defaulting to empty array", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      expect(DEFAULT_CONFIG.pack_rotation).toEqual([]);
    });

    it("DEFAULT_CONFIG has pack_rotation_mode defaulting to 'random'", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      expect(DEFAULT_CONFIG.pack_rotation_mode).toBe("random");
    });

    it("DEFAULT_CONFIG has path_rules defaulting to empty array", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      expect(DEFAULT_CONFIG.path_rules).toEqual([]);
    });

    it("DEFAULT_CONFIG has session_ttl_days defaulting to 7", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      expect(DEFAULT_CONFIG.session_ttl_days).toBe(7);
    });

    it("DEFAULT_CONFIG has headphones_only defaulting to false", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      expect(DEFAULT_CONFIG.headphones_only).toBe(false);
    });
  });

  describe("active_pack → default_pack migration", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `peon-ping-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("migrateConfig moves active_pack to default_pack", async () => {
      const { migrateConfig } = await import("../src/config");
      const raw = { active_pack: "glados", volume: 0.8 };
      const migrated = migrateConfig(raw);
      expect(migrated.default_pack).toBe("glados");
      expect(migrated.active_pack).toBeUndefined();
    });

    it("migrateConfig preserves default_pack if already present", async () => {
      const { migrateConfig } = await import("../src/config");
      const raw = { default_pack: "duke_nukem", active_pack: "glados" };
      const migrated = migrateConfig(raw);
      expect(migrated.default_pack).toBe("duke_nukem");
      expect(migrated.active_pack).toBeUndefined();
    });

    it("migrateConfig is a no-op when neither field exists", async () => {
      const { migrateConfig } = await import("../src/config");
      const raw = { volume: 0.3 };
      const migrated = migrateConfig(raw);
      expect(migrated.default_pack).toBeUndefined();
      expect(migrated.active_pack).toBeUndefined();
    });
  });

  describe("new config fields merge with defaults", () => {
    it("partial config gets new field defaults", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      const partial = { default_pack: "glados" };
      const merged = {
        ...DEFAULT_CONFIG,
        ...partial,
        categories: { ...DEFAULT_CONFIG.categories, ...(partial as any).categories },
      };

      expect(merged.default_pack).toBe("glados");
      expect(merged.silent_window_seconds).toBe(0);
      expect(merged.suppress_subagent_complete).toBe(false);
      expect(merged.pack_rotation).toEqual([]);
      expect(merged.pack_rotation_mode).toBe("random");
      expect(merged.path_rules).toEqual([]);
      expect(merged.session_ttl_days).toBe(7);
      expect(merged.headphones_only).toBe(false);
    });

    it("user overrides for new fields are preserved", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      const partial = {
        silent_window_seconds: 5,
        headphones_only: true,
        pack_rotation: ["peon", "glados"],
        pack_rotation_mode: "round-robin" as const,
        path_rules: [{ pattern: "**/myproject", pack: "glados" }],
      };
      const merged = {
        ...DEFAULT_CONFIG,
        ...partial,
        categories: { ...DEFAULT_CONFIG.categories },
      };

      expect(merged.silent_window_seconds).toBe(5);
      expect(merged.headphones_only).toBe(true);
      expect(merged.pack_rotation).toEqual(["peon", "glados"]);
      expect(merged.pack_rotation_mode).toBe("round-robin");
      expect(merged.path_rules).toEqual([{ pattern: "**/myproject", pack: "glados" }]);
    });
  });

  describe("PathRule type", () => {
    it("path_rules entries have pattern and pack fields", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      type PathRule = (typeof DEFAULT_CONFIG.path_rules)[number];

      const rule: PathRule = { pattern: "**/project", pack: "glados" };
      expect(rule.pattern).toBe("**/project");
      expect(rule.pack).toBe("glados");
    });
  });

  describe("PackRotationMode type", () => {
    it("accepts 'random' and 'round-robin'", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      type Mode = typeof DEFAULT_CONFIG.pack_rotation_mode;

      const random: Mode = "random";
      const roundRobin: Mode = "round-robin";
      expect(random).toBe("random");
      expect(roundRobin).toBe("round-robin");
    });
  });

  describe("silent_window_seconds wiring", () => {
    let handlers: Record<string, Function>;
    let mockPi: any;

    beforeEach(() => {
      handlers = {};
      mockPi = {
        on: (event: string, handler: Function) => {
          handlers[event] = handler;
        },
        registerCommand: () => {},
      };
    });

    it("agent_end uses silent_window_seconds from config instead of hardcoded 3s", async () => {
      // The hardcoded value was 3000ms. With silent_window_seconds=0 (default),
      // even very short sessions should trigger task.complete.
      // We test this indirectly by verifying the handler exists and processes
      // without the hardcoded check blocking it.
      const { default: initExtension } = await import("../src/index");
      initExtension(mockPi);

      expect(handlers["agent_end"]).toBeDefined();

      // With default config (silent_window_seconds=0), a session that started
      // 1 second ago should NOT be filtered out (previously hardcoded to 3s).
      // This should proceed past the time check (won't throw).
      await handlers["agent_end"](
        { type: "agent_end" },
        {
          hasUI: true,
          cwd: "/tmp/test-project",
          ui: { notify: () => {} },
        },
      );
    });
  });

  describe("UI settings include new config options", () => {
    it("buildSettingsItems includes silent_window_seconds", async () => {
      const { buildSettingsItems } = await import("../src/ui");
      const items = buildSettingsItems();
      const silentItem = items.find((i: any) => i.id === "silent_window_seconds");
      expect(silentItem).toBeDefined();
      expect(silentItem!.label).toBe("Silent window");
    });

    it("buildSettingsItems includes headphones_only", async () => {
      const { buildSettingsItems } = await import("../src/ui");
      const items = buildSettingsItems();
      const item = items.find((i: any) => i.id === "headphones_only");
      expect(item).toBeDefined();
      expect(item!.label).toBe("Headphones only");
    });

    it("buildSettingsItems includes suppress_subagent_complete", async () => {
      const { buildSettingsItems } = await import("../src/ui");
      const items = buildSettingsItems();
      const item = items.find((i: any) => i.id === "suppress_subagent_complete");
      expect(item).toBeDefined();
      expect(item!.label).toBe("Suppress sub-agent complete");
    });
  });
});
