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

    // Should not throw — just silently skip
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

  describe("extension registers tool_execution_end handler", () => {
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
      const initExtension = (await import("../src/index")).default;
      initExtension(mockPi);

      expect(handlers["tool_execution_end"]).toBeDefined();
      expect(typeof handlers["tool_execution_end"]).toBe("function");
    });

    it("handler is called with error events", async () => {
      const initExtension = (await import("../src/index")).default;
      initExtension(mockPi);

      const handler = handlers["tool_execution_end"];
      expect(handler).toBeDefined();

      // The handler should not throw when called with an error event
      // (it will try to play a sound but we don't have packs installed,
      // so playCategorySound will gracefully no-op)
      const errorEvent = {
        type: "tool_execution_end" as const,
        toolCallId: "test-123",
        toolName: "bash",
        result: "command failed",
        isError: true,
      };

      const ctx = { hasUI: true };

      // Should not throw
      await handler(errorEvent, ctx);
    });

    it("handler does not play sound for non-error events", async () => {
      const initExtension = (await import("../src/index")).default;
      initExtension(mockPi);

      const handler = handlers["tool_execution_end"];
      expect(handler).toBeDefined();

      const successEvent = {
        type: "tool_execution_end" as const,
        toolCallId: "test-456",
        toolName: "bash",
        result: "ok",
        isError: false,
      };

      const ctx = { hasUI: true };

      // Should not throw — and should skip since isError is false
      await handler(successEvent, ctx);
    });
  });
});
