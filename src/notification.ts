import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { detectPlatform, type Platform } from "./platform";

export type Notifier = "osascript" | "notify-send" | "powershell";

export interface NotifyCommand {
  bin: string;
  args: string[];
}

function defaultCommandExists(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function escapeNotificationText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function detectNotifier(
  platform: Platform = detectPlatform(),
  commandExists: (cmd: string) => boolean = defaultCommandExists,
): Notifier | null {
  switch (platform) {
    case "mac":
      return "osascript";
    case "linux":
      return commandExists("notify-send") ? "notify-send" : null;
    case "wsl":
      return "powershell";
    default:
      return null;
  }
}

export function buildNotifyCommand(
  notifier: Notifier | string,
  title: string,
  body: string,
): NotifyCommand | null {
  const safeTitle = escapeNotificationText(title);
  const safeBody = escapeNotificationText(body);

  switch (notifier) {
    case "osascript": {
      const script = `display notification "${safeBody}" with title "${safeTitle}"`;
      return { bin: "osascript", args: ["-e", script] };
    }
    case "notify-send":
      return { bin: "notify-send", args: [title, body] };
    case "powershell": {
      const ps = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$text = $template.GetElementsByTagName('text')
$text.Item(0).AppendChild($template.CreateTextNode('${safeTitle}')) > $null
$text.Item(1).AppendChild($template.CreateTextNode('${safeBody}')) > $null
$toast = [Windows.UI.Notifications.ToastNotification]::new($template)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('peon-ping').Show($toast)
`.trim();
      return { bin: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-Command", ps] };
    }
    default:
      return null;
  }
}

export function sendDesktopNotification(
  title: string,
  body: string,
  platform: Platform = detectPlatform(),
): boolean {
  const notifier = detectNotifier(platform);
  if (!notifier) return false;

  const cmd = buildNotifyCommand(notifier, title, body);
  if (!cmd) return false;

  try {
    const child = spawn(cmd.bin, cmd.args, { stdio: "ignore", detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
