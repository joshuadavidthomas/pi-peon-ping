import { describe, it, expect, spyOn } from "bun:test";

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
      // Should not contain unescaped double quotes that would break the AppleScript
      expect(script).not.toMatch(/(?<!\\)"{2}/);
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

  describe("sendDesktopNotification", () => {
    it("returns false when no notifier is available", async () => {
      const { sendDesktopNotification } = await import("../src/notification");
      // Pass "unknown" platform explicitly
      const result = sendDesktopNotification("Title", "Body", "unknown");
      expect(result).toBe(false);
    });

    it("does not write OSC escape sequences", async () => {
      const writeSpy = spyOn(process.stdout, "write");
      try {
        const { sendDesktopNotification } = await import("../src/notification");
        // Even on a real platform, should never use OSC
        sendDesktopNotification("Title", "Body", "unknown");

        const oscCalls = writeSpy.mock.calls.filter(
          (call) => typeof call[0] === "string" && (call[0] as string).includes("\x1b]777"),
        );
        expect(oscCalls.length).toBe(0);
      } finally {
        writeSpy.mockRestore();
      }
    });
  });
});
