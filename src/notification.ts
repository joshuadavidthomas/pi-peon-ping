import { spawn, execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { DATA_DIR } from "./constants";
import { detectPlatform, type Platform } from "./platform";

export const DEFAULT_ICON_PATH = join(DATA_DIR, "peon-icon.png");
export const DEFAULT_ICON_NAME = "peon-ping";
const HICOLOR_ICON_DIR = join(homedir(), ".local", "share", "icons", "hicolor", "64x64", "apps");
const HICOLOR_ICON_PATH = join(HICOLOR_ICON_DIR, "peon-ping.png");

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

export function installIcon(): void {
  if (!existsSync(DEFAULT_ICON_PATH)) return;
  if (existsSync(HICOLOR_ICON_PATH)) return;
  try {
    mkdirSync(HICOLOR_ICON_DIR, { recursive: true });
    copyFileSync(DEFAULT_ICON_PATH, HICOLOR_ICON_PATH);
    execSync("gtk-update-icon-cache -f -t " + join(homedir(), ".local", "share", "icons", "hicolor"), {
      stdio: "ignore",
    });
  } catch {}
}

export function resolveIcon(packPath?: string): string {
  if (packPath) {
    const packIcon = join(packPath, "icon.png");
    if (existsSync(packIcon)) return packIcon;
  }
  if (existsSync(HICOLOR_ICON_PATH)) return DEFAULT_ICON_NAME;
  return DEFAULT_ICON_PATH;
}

export function buildNotifyCommand(
  notifier: Notifier | string,
  title: string,
  body: string,
  iconPath?: string,
): NotifyCommand | null {
  const safeTitle = escapeNotificationText(title);
  const safeBody = escapeNotificationText(body);

  switch (notifier) {
    case "osascript": {
      const script = `display notification "${safeBody}" with title "${safeTitle}"`;
      return { bin: "osascript", args: ["-e", script] };
    }
    case "notify-send": {
      const args = [];
      if (iconPath) args.push(`--icon=${iconPath}`);
      args.push(title, body);
      return { bin: "notify-send", args };
    }
    case "powershell": {
      let iconXml = "";
      if (iconPath) {
        const winPath = iconPath.replace(/\//g, "\\");
        iconXml = `\n$binding = $template.GetElementsByTagName('binding')[0]\n$img = $template.CreateElement('image')\n$img.SetAttribute('placement','appLogoOverride')\n$img.SetAttribute('src','${winPath}')\n$binding.AppendChild($img) > $null`;
      }
      const ps = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$text = $template.GetElementsByTagName('text')
$text.Item(0).AppendChild($template.CreateTextNode('${safeTitle}')) > $null
$text.Item(1).AppendChild($template.CreateTextNode('${safeBody}')) > $null${iconXml}
$toast = [Windows.UI.Notifications.ToastNotification]::new($template)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('peon-ping').Show($toast)
`.trim();
      return { bin: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-Command", ps] };
    }
    default:
      return null;
  }
}

export interface NotifyOptions {
  platform?: Platform;
  iconPath?: string;
}

export function sendDesktopNotification(
  title: string,
  body: string,
  options: NotifyOptions | Platform = {},
): boolean {
  const opts: NotifyOptions = typeof options === "string"
    ? { platform: options }
    : options;
  const platform = opts.platform ?? detectPlatform();
  const notifier = detectNotifier(platform);
  if (!notifier) return false;

  const cmd = buildNotifyCommand(notifier, title, body, opts.iconPath);
  if (!cmd) return false;

  try {
    const child = spawn(cmd.bin, cmd.args, { stdio: "ignore", detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
