import { spawn } from "node:child_process";
import { detectLinuxPlayer, detectPlatform, type Platform } from "./platform";
import { saveState } from "./config";
import { pickSound } from "./packs";
import { getRelayUrl, relayPlayCategory, relayNotify } from "./relay";
import type { PeonConfig, PeonState } from "./types";

const PLATFORM: Platform = detectPlatform();

let currentSoundPid: number | null = null;

export function killPreviousSound(): void {
  if (currentSoundPid !== null) {
    try {
      process.kill(currentSoundPid);
    } catch {}
    currentSoundPid = null;
  }
}

export function playSound(file: string, volume: number): void {
  killPreviousSound();

  let child;

  switch (PLATFORM) {
    case "mac":
      child = spawn("afplay", ["-v", String(volume), file], {
        stdio: "ignore",
        detached: true,
      });
      break;

    case "wsl": {
      const cmd = `
        Add-Type -AssemblyName PresentationCore
        $p = New-Object System.Windows.Media.MediaPlayer
        $p.Open([Uri]::new('file:///${file.replace(/\//g, "\\")}'))
        $p.Volume = ${volume}
        Start-Sleep -Milliseconds 200
        $p.Play()
        Start-Sleep -Seconds 3
        $p.Close()
      `;
      child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], {
        stdio: "ignore",
        detached: true,
      });
      break;
    }

    case "linux": {
      const player = detectLinuxPlayer();
      if (!player) return;

      switch (player) {
        case "pw-play":
          child = spawn("pw-play", ["--volume", String(volume), file], {
            stdio: "ignore", detached: true,
          });
          break;
        case "paplay": {
          const paVol = Math.max(0, Math.min(65536, Math.round(volume * 65536)));
          child = spawn("paplay", [`--volume=${paVol}`, file], {
            stdio: "ignore", detached: true,
          });
          break;
        }
        case "ffplay": {
          const ffVol = Math.max(0, Math.min(100, Math.round(volume * 100)));
          child = spawn("ffplay", ["-nodisp", "-autoexit", "-volume", String(ffVol), file], {
            stdio: "ignore", detached: true,
          });
          break;
        }
        case "mpv": {
          const mpvVol = Math.max(0, Math.min(100, Math.round(volume * 100)));
          child = spawn("mpv", ["--no-video", `--volume=${mpvVol}`, file], {
            stdio: "ignore", detached: true,
          });
          break;
        }
        case "play":
          child = spawn("play", ["-v", String(volume), file], {
            stdio: "ignore", detached: true,
          });
          break;
        case "aplay":
          child = spawn("aplay", ["-q", file], {
            stdio: "ignore", detached: true,
          });
          break;
      }
      break;
    }
  }

  if (child) {
    child.unref();
    currentSoundPid = child.pid ?? null;
    child.on("exit", () => {
      if (currentSoundPid === child.pid) currentSoundPid = null;
    });
  }
}

export function sendNotification(title: string, body: string, config: PeonConfig): void {
  const relayUrl = getRelayUrl(config.relay_mode);
  if (relayUrl) {
    relayNotify(relayUrl, title, body).catch(() => {});
    return;
  }
  process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
}

export function playCategorySound(category: string, config: PeonConfig, state: PeonState): void {
  if (!config.enabled || state.paused) return;

  const relayUrl = getRelayUrl(config.relay_mode);
  if (relayUrl) {
    relayPlayCategory(relayUrl, category).catch(() => {});
    return;
  }

  const sound = pickSound(category, config, state);
  if (sound) {
    playSound(sound.file, config.volume);
    saveState(state);
  }
}
