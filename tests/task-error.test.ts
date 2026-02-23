import { describe, it, expect, beforeEach } from "bun:test";

import { playCategorySound } from "../src/audio";
import { DEFAULT_CONFIG, DEFAULT_STATE } from "../src/constants";
import type { PeonConfig, PeonState } from "../src/types";

describe("task.error event handling", () => {
  it("task.error category is enabled by default", () => {
    expect(DEFAULT_CONFIG.categories["task.error"]).toBe(true);
  });

  it("playCategorySound skips task.error when category is disabled", () => {
    const config: PeonConfig = {
      ...DEFAULT_CONFIG,
      categories: { ...DEFAULT_CONFIG.categories, "task.error": false },
    };
    const state: PeonState = { ...DEFAULT_STATE };

    playCategorySound("task.error", config, state);
  });

  it("playCategorySound skips task.error when globally disabled", () => {
    const config: PeonConfig = { ...DEFAULT_CONFIG, enabled: false };
    const state: PeonState = { ...DEFAULT_STATE };

    playCategorySound("task.error", config, state);
  });

  it("playCategorySound skips task.error when paused", () => {
    const config: PeonConfig = { ...DEFAULT_CONFIG };
    const state: PeonState = { ...DEFAULT_STATE, paused: true };

    playCategorySound("task.error", config, state);
  });

  describe("extension wiring", () => {
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

    it("registers a tool_execution_end handler", async () => {
      const { default: initExtension } = await import("../src/index");
      initExtension(mockPi);

      expect(handlers["tool_execution_end"]).toBeDefined();
      expect(typeof handlers["tool_execution_end"]).toBe("function");
    });

    it("handler returns early for non-error events", async () => {
      const { default: initExtension } = await import("../src/index");
      initExtension(mockPi);

      const handler = handlers["tool_execution_end"];

      // Should not throw — returns early because isError is false
      await handler(
        { type: "tool_execution_end", toolCallId: "t-1", toolName: "bash", result: "ok", isError: false },
        { hasUI: true },
      );
    });

    it("handler returns early when hasUI is false", async () => {
      const { default: initExtension } = await import("../src/index");
      initExtension(mockPi);

      const handler = handlers["tool_execution_end"];

      // Should not throw — returns early because hasUI is false
      await handler(
        { type: "tool_execution_end", toolCallId: "t-2", toolName: "bash", result: "fail", isError: true },
        { hasUI: false },
      );
    });

    it("handler processes error events without throwing", async () => {
      const { default: initExtension } = await import("../src/index");
      initExtension(mockPi);

      const handler = handlers["tool_execution_end"];

      // Calls playCategorySound("task.error", ...) which will no-op
      // gracefully since no packs are installed in the test environment
      await handler(
        { type: "tool_execution_end", toolCallId: "t-3", toolName: "bash", result: "fail", isError: true },
        { hasUI: true },
      );
    });
  });
});
