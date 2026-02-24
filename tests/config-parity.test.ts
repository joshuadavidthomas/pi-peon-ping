import { describe, it, expect, beforeEach } from "bun:test";

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

  });

  describe("active_pack → default_pack migration", () => {
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
    });

    it("user overrides for new fields are preserved", async () => {
      const { DEFAULT_CONFIG } = await import("../src/constants");
      const partial = {
        silent_window_seconds: 5,
      };
      const merged = {
        ...DEFAULT_CONFIG,
        ...partial,
        categories: { ...DEFAULT_CONFIG.categories },
      };

      expect(merged.silent_window_seconds).toBe(5);
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

    it("agent_end handler completes without throwing", async () => {
      const { default: initExtension } = await import("../src/index");
      initExtension(mockPi);

      expect(handlers["agent_end"]).toBeDefined();

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


  });
});
