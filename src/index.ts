/**
 * peon-ping — Sound notifications for pi
 *
 * Plays themed audio clips on lifecycle events (session start, task ack,
 * task complete, permission needed). Uses peon-ping / OpenPeon sound packs.
 *
 * /peon opens a settings panel. /peon install downloads packs.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { basename } from "node:path";
import { playCategorySound, sendNotification } from "./audio";
import { ensureDirs, loadConfig, loadState, saveState } from "./config";
import { listPacks } from "./packs";
import { createSettingsPanel, runInstall } from "./ui";

export default function (pi: ExtensionAPI) {
  ensureDirs();
  let config = loadConfig();
  let state = loadState();
  let installing = false;

  const hasPacks = () => listPacks().length > 0;

  const shouldPlaySounds = (ctx: { hasUI: boolean }) =>
    ctx.hasUI && !installing && hasPacks();

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    if (!hasPacks()) {
      ctx.ui.notify("peon-ping: no sound packs. Run /peon install", "warning");
      return;
    }

    config = loadConfig();
    state = loadState();
    state.session_start_time = Date.now();
    state.prompt_timestamps = [];
    saveState(state);

    playCategorySound("session.start", config, state);
  });

  pi.on("agent_start", async (_event, ctx) => {
    if (!shouldPlaySounds(ctx)) return;

    config = loadConfig();
    state = loadState();

    const now = Date.now();
    const window = config.annoyed_window_seconds * 1000;
    state.prompt_timestamps = state.prompt_timestamps.filter((t) => now - t < window);
    state.prompt_timestamps.push(now);
    saveState(state);

    if (state.prompt_timestamps.length >= config.annoyed_threshold) {
      playCategorySound("user.spam", config, state);
    } else {
      playCategorySound("task.acknowledge", config, state);
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!shouldPlaySounds(ctx)) return;

    config = loadConfig();
    state = loadState();

    const now = Date.now();
    if (now - state.last_stop_time < 5000) return;
    state.last_stop_time = now;

    if (now - state.session_start_time < 3000) return;

    saveState(state);
    playCategorySound("task.complete", config, state);

    if (config.enabled && !state.paused) {
      const project = basename(ctx.cwd);
      sendNotification(`pi · ${project}`, "Task complete");
    }
  });

  pi.registerCommand("peon", {
    description: "peon-ping sound settings",
    handler: async (args, ctx) => {
      const sub = (args || "").trim();

      if (sub === "install" || sub.startsWith("install ")) {
        const packNames = sub.replace(/^install\s*/, "").trim().split(/\s+/).filter(Boolean);
        await runInstall(
          packNames,
          ctx,
          () => { installing = true; },
          () => { installing = false; },
        );
        return;
      }

      if (!hasPacks()) {
        const ok = await ctx.ui.confirm(
          "peon-ping",
          "No sound packs installed. Download default packs now?",
        );
        if (ok) {
          await runInstall(
            [],
            ctx,
            () => { installing = true; },
            () => { installing = false; },
          );
        }
        return;
      }

      await ctx.ui.custom<void>(createSettingsPanel);
    },
  });
}
