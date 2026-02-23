import { describe, it, expect, mock } from "bun:test";
import { DEFAULT_CONFIG } from "../src/constants";
import type { PeonConfig } from "../src/types";

// Mock notification module so tests never spawn real processes
const mockSendDesktop = mock(() => false);
mock.module("../src/notification", () => ({
  sendDesktopNotification: mockSendDesktop,
  resolveIcon: () => "/fake/icon.png",
  DEFAULT_ICON_PATH: "/fake/icon.png",
}));

const { sendNotification } = await import("../src/audio");

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
