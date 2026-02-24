import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { platform as osPlatform } from "node:os";

export type Platform = "mac" | "linux" | "wsl" | "unknown";

export function detectPlatform(): Platform {
  const p = osPlatform();
  if (p === "darwin") return "mac";
  if (p === "linux") {
    try {
      const version = readFileSync("/proc/version", "utf8");
      if (/microsoft/i.test(version)) return "wsl";
    } catch {}
    return "linux";
  }
  return "unknown";
}

let cachedLinuxPlayer: string | null | undefined;

export function detectLinuxPlayer(): string | null {
  if (cachedLinuxPlayer !== undefined) return cachedLinuxPlayer;
  for (const cmd of ["pw-play", "paplay", "ffplay", "mpv", "play", "aplay"]) {
    try {
      execSync(`command -v ${cmd}`, { stdio: "pipe" });
      cachedLinuxPlayer = cmd;
      return cmd;
    } catch {}
  }
  cachedLinuxPlayer = null;
  return null;
}
