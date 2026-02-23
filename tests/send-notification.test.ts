import { describe, it, expect, spyOn, mock } from "bun:test";
import { DEFAULT_CONFIG } from "../src/constants";
import type { PeonConfig } from "../src/types";

// Mock the notification module so tests never spawn real processes.
// All tests that import ../src/audio with a mocked notification module
// must live in this file — bun's mock.module leaks across parallel files.
const mockSendDesktop = mock(() => false);
mock.module("../src/notification", () => ({
  sendDesktopNotification: mockSendDesktop,
  resolveIcon: () => "/fake/icon.png",
  DEFAULT_ICON_PATH: "/fake/icon.png",
}));

const { sendNotification } = await import("../src/audio");

describe("sendNotification", () => {
  it("does not write OSC escape sequences", () => {
    const writeSpy = spyOn(process.stdout, "write");
    try {
      mockSendDesktop.mockReturnValue(false);
      const config: PeonConfig = { ...DEFAULT_CONFIG, relay_mode: "local" };
      sendNotification("Title", "Body", config);

      const oscCalls = writeSpy.mock.calls.filter(
        (call) => typeof call[0] === "string" && (call[0] as string).includes("\x1b]777"),
      );
      expect(oscCalls.length).toBe(0);
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("calls uiNotify as fallback when native notification is unavailable", () => {
    const notifications: { message: string; type: string }[] = [];
    const uiNotify = (message: string, type?: "info" | "warning" | "error") => {
      notifications.push({ message, type: type ?? "info" });
    };

    mockSendDesktop.mockReturnValue(false);
    const config: PeonConfig = { ...DEFAULT_CONFIG, relay_mode: "local" };
    sendNotification("pi · project", "Task complete", config, uiNotify);

    expect(notifications.length).toBe(1);
    expect(notifications[0].message).toContain("Task complete");
  });

  it("does not call uiNotify when native notification succeeds", () => {
    const notifications: string[] = [];
    const uiNotify = (message: string) => {
      notifications.push(message);
    };

    mockSendDesktop.mockReturnValue(true);
    const config: PeonConfig = { ...DEFAULT_CONFIG, relay_mode: "local" };
    sendNotification("pi · project", "Task complete", config, uiNotify);

    expect(notifications.length).toBe(0);
  });

  it("uiNotify fallback includes title and body in message", () => {
    const notifications: string[] = [];
    const uiNotify = (message: string) => {
      notifications.push(message);
    };

    mockSendDesktop.mockReturnValue(false);
    const config: PeonConfig = { ...DEFAULT_CONFIG, relay_mode: "local" };
    sendNotification("pi · myproject", "Task complete", config, uiNotify);

    expect(notifications.length).toBe(1);
    expect(notifications[0]).toContain("pi · myproject");
    expect(notifications[0]).toContain("Task complete");
  });

  it("calls sendDesktopNotification with title, body, and icon", () => {
    mockSendDesktop.mockClear();
    mockSendDesktop.mockReturnValue(true);
    const config: PeonConfig = { ...DEFAULT_CONFIG, relay_mode: "local" };
    sendNotification("pi · test", "Done", config);

    expect(mockSendDesktop).toHaveBeenCalledTimes(1);
    const call = mockSendDesktop.mock.calls[0] as unknown[];
    expect(call[0]).toBe("pi · test");
    expect(call[1]).toBe("Done");
    const opts = call[2] as { iconPath?: string };
    expect(opts).toHaveProperty("iconPath");
  });
});

describe("desktop_notifications config toggle", () => {
  it("DEFAULT_CONFIG has desktop_notifications enabled", () => {
    expect(DEFAULT_CONFIG.desktop_notifications).toBe(true);
  });

  it("sendNotification fires when desktop_notifications is true", () => {
    mockSendDesktop.mockClear();
    mockSendDesktop.mockReturnValue(true);
    const config: PeonConfig = { ...DEFAULT_CONFIG, relay_mode: "local", desktop_notifications: true };
    sendNotification("title", "body", config);
    expect(mockSendDesktop).toHaveBeenCalledTimes(1);
  });

  it("sendNotification skips when desktop_notifications is false", () => {
    mockSendDesktop.mockClear();
    const config: PeonConfig = { ...DEFAULT_CONFIG, relay_mode: "local", desktop_notifications: false };
    sendNotification("title", "body", config);
    expect(mockSendDesktop).not.toHaveBeenCalled();
  });

  it("sendNotification skips uiNotify fallback when desktop_notifications is false", () => {
    mockSendDesktop.mockClear();
    const notifications: string[] = [];
    const uiNotify = (msg: string) => notifications.push(msg);
    const config: PeonConfig = { ...DEFAULT_CONFIG, relay_mode: "local", desktop_notifications: false };
    sendNotification("title", "body", config, uiNotify);
    expect(notifications.length).toBe(0);
  });
});


