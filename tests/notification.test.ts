import { describe, it, expect, spyOn } from "bun:test";
import { join } from "node:path";

describe("notification", () => {
  describe("detectNotifier", () => {
    it("returns 'osascript' on mac", async () => {
      const { detectNotifier } = await import("../src/notification");
      expect(detectNotifier("mac")).toBe("osascript");
    });

    it("returns 'notify-send' on linux when available", async () => {
      const { detectNotifier } = await import("../src/notification");
      const exists = (cmd: string) => cmd === "notify-send";
      expect(detectNotifier("linux", exists)).toBe("notify-send");
    });

    it("returns null on linux when notify-send is not available", async () => {
      const { detectNotifier } = await import("../src/notification");
      const exists = (_cmd: string) => false;
      expect(detectNotifier("linux", exists)).toBeNull();
    });

    it("returns 'powershell' on wsl", async () => {
      const { detectNotifier } = await import("../src/notification");
      expect(detectNotifier("wsl")).toBe("powershell");
    });

    it("returns null on unknown platform", async () => {
      const { detectNotifier } = await import("../src/notification");
      expect(detectNotifier("unknown")).toBeNull();
    });
  });

  describe("buildNotifyCommand", () => {
    it("builds osascript command for mac", async () => {
      const { buildNotifyCommand } = await import("../src/notification");
      const cmd = buildNotifyCommand("osascript", "Test Title", "Test Body");
      expect(cmd).not.toBeNull();
      expect(cmd!.bin).toBe("osascript");
      expect(cmd!.args).toContain("-e");
      const script = cmd!.args[cmd!.args.indexOf("-e") + 1];
      expect(script).toContain("Test Title");
      expect(script).toContain("Test Body");
    });

    it("builds notify-send command for linux", async () => {
      const { buildNotifyCommand } = await import("../src/notification");
      const cmd = buildNotifyCommand("notify-send", "Hello", "World");
      expect(cmd).not.toBeNull();
      expect(cmd!.bin).toBe("notify-send");
      expect(cmd!.args).toContain("Hello");
      expect(cmd!.args).toContain("World");
    });

    it("builds powershell toast command for wsl", async () => {
      const { buildNotifyCommand } = await import("../src/notification");
      const cmd = buildNotifyCommand("powershell", "Title", "Body");
      expect(cmd).not.toBeNull();
      expect(cmd!.bin).toBe("powershell.exe");
      const scriptArg = cmd!.args.find((a: string) => a.includes("Title"));
      expect(scriptArg).toBeDefined();
      expect(scriptArg).toContain("Body");
    });

    it("returns null for unknown notifier", async () => {
      const { buildNotifyCommand } = await import("../src/notification");
      const cmd = buildNotifyCommand("unknown-thing" as any, "T", "B");
      expect(cmd).toBeNull();
    });

    it("escapes special characters in title and body", async () => {
      const { buildNotifyCommand } = await import("../src/notification");
      const cmd = buildNotifyCommand("osascript", 'say "hi"', "it's done");
      expect(cmd).not.toBeNull();
      const script = cmd!.args[cmd!.args.indexOf("-e") + 1];
      expect(script).not.toMatch(/(?<!\\)"{2}/);
    });

    it("includes --icon for notify-send when iconPath provided", async () => {
      const { buildNotifyCommand } = await import("../src/notification");
      const cmd = buildNotifyCommand("notify-send", "Hello", "World", "/path/to/icon.png");
      expect(cmd).not.toBeNull();
      expect(cmd!.args).toContain("--icon=/path/to/icon.png");
    });

    it("omits --icon for notify-send when no iconPath", async () => {
      const { buildNotifyCommand } = await import("../src/notification");
      const cmd = buildNotifyCommand("notify-send", "Hello", "World");
      expect(cmd).not.toBeNull();
      const hasIcon = cmd!.args.some((a: string) => a.startsWith("--icon"));
      expect(hasIcon).toBe(false);
    });

    it("includes icon in osascript when iconPath provided", async () => {
      // osascript doesn't support custom icons natively, so we just confirm it doesn't break
      const { buildNotifyCommand } = await import("../src/notification");
      const cmd = buildNotifyCommand("osascript", "Title", "Body", "/path/to/icon.png");
      expect(cmd).not.toBeNull();
      expect(cmd!.bin).toBe("osascript");
    });

    it("includes icon in powershell toast when iconPath provided", async () => {
      const { buildNotifyCommand } = await import("../src/notification");
      const cmd = buildNotifyCommand("powershell", "Title", "Body", "/path/to/icon.png");
      expect(cmd).not.toBeNull();
      const scriptArg = cmd!.args.find((a: string) => a.includes("icon.png"));
      expect(scriptArg).toBeDefined();
    });
  });

  describe("escapeNotificationText", () => {
    it("escapes double quotes", async () => {
      const { escapeNotificationText } = await import("../src/notification");
      expect(escapeNotificationText('say "hello"')).toBe('say \\"hello\\"');
    });

    it("escapes backslashes", async () => {
      const { escapeNotificationText } = await import("../src/notification");
      expect(escapeNotificationText("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("handles clean strings unchanged", async () => {
      const { escapeNotificationText } = await import("../src/notification");
      expect(escapeNotificationText("Task complete")).toBe("Task complete");
    });
  });

  describe("resolveIcon", () => {
    it("returns pack icon.png when it exists", async () => {
      const { resolveIcon } = await import("../src/notification");
      // Use a temp dir with an icon.png to test
      const { mkdtempSync, writeFileSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const dir = mkdtempSync(join(tmpdir(), "peon-test-"));
      writeFileSync(join(dir, "icon.png"), "fake-png");

      const result = resolveIcon(dir);
      expect(result).toBe(join(dir, "icon.png"));
    });

    it("returns a default icon when pack has no icon", async () => {
      const { resolveIcon, DEFAULT_ICON_PATH, DEFAULT_ICON_NAME } = await import("../src/notification");
      const { mkdtempSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const dir = mkdtempSync(join(tmpdir(), "peon-test-"));

      const result = resolveIcon(dir);
      // Returns icon name if installed to hicolor, otherwise file path
      expect([DEFAULT_ICON_PATH, DEFAULT_ICON_NAME]).toContain(result);
    });

    it("returns a default icon when packPath is undefined", async () => {
      const { resolveIcon, DEFAULT_ICON_PATH, DEFAULT_ICON_NAME } = await import("../src/notification");
      const result = resolveIcon(undefined);
      expect([DEFAULT_ICON_PATH, DEFAULT_ICON_NAME]).toContain(result);
    });

    it("DEFAULT_ICON_PATH points to peon-icon.png in data dir", async () => {
      const { DEFAULT_ICON_PATH } = await import("../src/notification");
      expect(DEFAULT_ICON_PATH).toContain("peon-icon.png");
      expect(DEFAULT_ICON_PATH).toContain("peon-ping");
    });
  });

  describe("sendDesktopNotification", () => {
    it("returns false when no notifier is available", async () => {
      const { sendDesktopNotification } = await import("../src/notification");
      const result = sendDesktopNotification("Title", "Body", { platform: "unknown" });
      expect(result).toBe(false);
    });

    it("does not write OSC escape sequences", async () => {
      const writeSpy = spyOn(process.stdout, "write");
      try {
        const { sendDesktopNotification } = await import("../src/notification");
        sendDesktopNotification("Title", "Body", { platform: "unknown" });

        const oscCalls = writeSpy.mock.calls.filter(
          (call) => typeof call[0] === "string" && (call[0] as string).includes("\x1b]777"),
        );
        expect(oscCalls.length).toBe(0);
      } finally {
        writeSpy.mockRestore();
      }
    });

    it("accepts an iconPath option", async () => {
      const { sendDesktopNotification } = await import("../src/notification");
      // Should not throw when given an icon path, even on unknown platform
      const result = sendDesktopNotification("Title", "Body", {
        platform: "unknown",
        iconPath: "/some/icon.png",
      });
      expect(result).toBe(false);
    });
  });
});
