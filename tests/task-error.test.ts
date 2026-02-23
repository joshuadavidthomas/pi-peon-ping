import { describe, it, expect, beforeEach, mock, afterEach } from "bun:test";

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

  describe("extension wiring", () => {
    let handlers: Record<string, Function>;
    let mockPi: any;
    const mockPlayCategorySound = mock(() => {});
    const mockSendNotification = mock(() => {});

    beforeEach(() => {
      handlers = {};
      mockPi = {
        on: (event: string, handler: Function) => {
          handlers[event] = handler;
        },
        registerCommand: () => {},
      };
      mockPlayCategorySound.mockClear();
      mockSendNotification.mockClear();

      mock.module("../src/audio", () => ({
        playCategorySound: mockPlayCategorySound,
        sendNotification: mockSendNotification,
      }));
    });

    afterEach(() => {
      mock.restore();
    });

    it("registers a tool_execution_end handler", async () => {
      const { default: initExtension } = await import("../src/index");
      initExtension(mockPi);

      expect(handlers["tool_execution_end"]).toBeDefined();
      expect(typeof handlers["tool_execution_end"]).toBe("function");
    });

    it("plays task.error sound on error tool execution", async () => {
      const { default: initExtension } = await import("../src/index");
      initExtension(mockPi);

      const handler = handlers["tool_execution_end"];
      await handler(
        { type: "tool_execution_end", toolCallId: "t-1", toolName: "bash", result: "fail", isError: true },
        { hasUI: true },
      );

      const errorCalls = mockPlayCategorySound.mock.calls.filter(
        (call: unknown[]) => call[0] === "task.error",
      );
      expect(errorCalls.length).toBe(1);
    });

    it("does not play sound on successful tool execution", async () => {
      const { default: initExtension } = await import("../src/index");
      initExtension(mockPi);

      // Clear any calls from extension init (ensureDirs, etc.)
      mockPlayCategorySound.mockClear();

      const handler = handlers["tool_execution_end"];
      await handler(
        { type: "tool_execution_end", toolCallId: "t-2", toolName: "bash", result: "ok", isError: false },
        { hasUI: true },
      );

      expect(mockPlayCategorySound).not.toHaveBeenCalled();
    });

    it("does not play sound when hasUI is false", async () => {
      const { default: initExtension } = await import("../src/index");
      initExtension(mockPi);

      mockPlayCategorySound.mockClear();

      const handler = handlers["tool_execution_end"];
      await handler(
        { type: "tool_execution_end", toolCallId: "t-3", toolName: "bash", result: "fail", isError: true },
        { hasUI: false },
      );

      expect(mockPlayCategorySound).not.toHaveBeenCalled();
    });
  });
});
