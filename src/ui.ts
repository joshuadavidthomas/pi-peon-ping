import { DynamicBorder, getSettingsListTheme, keyHint } from "@mariozechner/pi-coding-agent";
import {
  CancellableLoader,
  Container,
  type Component,
  type SettingItem,
  SettingsList,
  SelectList,
  Spacer,
  Text,
} from "@mariozechner/pi-tui";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { detectPreferredLanguageTags } from "./locale";
import {
  buildRegistryPackDescription,
  buildRegistryPackLabel,
  resolveRequestedPackNames,
  selectLocaleInstallPackNames,
  sortRegistryPacksForLocale,
} from "./install-options";
import { killPreviousSound, playSound } from "./audio";
import { loadConfig, loadState, saveConfig, saveState } from "./config";
import { CATEGORY_LABELS, DEFAULT_PACK_NAMES, VOLUME_STEPS } from "./constants";
import { downloadPack, fetchRegistry, getPacksDir, listPacks, loadManifest, pickSound } from "./packs";
import { detectRemoteSession, getRelayUrl } from "./relay";
import type { Registry, RelayMode } from "./types";

const REGISTRY_PICKER_DEFAULT_VISIBLE = 12;

export function createPackPickerSubmenu(
  currentPack: string,
  packs: { name: string; displayName: string }[],
  slTheme: ReturnType<typeof getSettingsListTheme>,
  onSelect: (name: string) => void,
  onCancel: () => void,
): Component {
  const items = packs.map((p) => ({
    value: p.name,
    label: `${p.name === currentPack ? "▶ " : "  "}${p.displayName}`,
    description: p.name,
  }));

  const list = new SelectList(items, Math.min(items.length, 12), {
    selectedPrefix: (t: string) => slTheme.label(t, true),
    selectedText: (t: string) => slTheme.label(t, true),
    description: slTheme.description,
    scrollInfo: slTheme.hint,
    noMatch: (t: string) => slTheme.label(t, false),
  });

  list.onSelect = (item) => onSelect(item.value);
  list.onCancel = () => {
    killPreviousSound();
    onCancel();
  };

  list.onSelectionChange = (item) => {
    const packsDir = getPacksDir();
    const packPath = join(packsDir, item.value);
    const manifest = loadManifest(packPath);
    if (!manifest) return;

    const cat = manifest.categories["session.start"] || Object.values(manifest.categories)[0];
    if (!cat?.sounds?.length) return;

    const pick = cat.sounds[Math.floor(Math.random() * cat.sounds.length)];
    const file = pick.file.includes("/")
      ? join(packPath, pick.file)
      : join(packPath, "sounds", pick.file);

    if (existsSync(file)) {
      const cfg = loadConfig();
      playSound(file, cfg.volume);
    }
  };

  const idx = packs.findIndex((p) => p.name === currentPack);
  if (idx >= 0) list.setSelectedIndex(idx);

  return {
    render(width: number) { return list.render(width); },
    invalidate() { list.invalidate(); },
    handleInput(data: string) { list.handleInput(data); },
  };
}

export function buildSettingsItems(): SettingItem[] {
  const config = loadConfig();
  const state = loadState();
  const packs = listPacks();
  const activePack = packs.find((p) => p.name === config.default_pack);

  const session = detectRemoteSession();
  const relayUrl = getRelayUrl(config.relay_mode);
  const relayDescription = relayUrl
    ? `→ ${relayUrl}${session ? ` (${session.type})` : ""}`
    : session
      ? `${session.type} detected, mode is "${config.relay_mode}"`
      : "No remote session detected";

  const items: SettingItem[] = [
    {
      id: "sounds",
      label: "Sounds",
      description: "Master toggle for all sound playback",
      currentValue: state.paused ? "paused" : "active",
      values: ["active", "paused"],
    },
    {
      id: "relay_mode",
      label: "Relay",
      description: relayDescription,
      currentValue: config.relay_mode,
      values: ["auto", "local", "relay"] as RelayMode[],
    },
    {
      id: "pack",
      label: "Sound pack",
      description: `${packs.length} installed`,
      currentValue: activePack?.displayName || config.default_pack,
      submenu: (_current: string, done: (val?: string) => void) => {
        if (packs.length === 0) {
          done();
          return { render: () => ["No packs installed"], invalidate() {}, handleInput() {} } as Component;
        }
        return createPackPickerSubmenu(
          config.default_pack,
          packs,
          getSettingsListTheme(),
          (name) => {
            const cfg = loadConfig();
            cfg.default_pack = name;
            saveConfig(cfg);
            const pack = packs.find((p) => p.name === name);
            done(pack?.displayName || name);
          },
          () => done(),
        );
      },
    },
    {
      id: "volume",
      label: "Volume",
      currentValue: `${Math.round(config.volume * 100)}%`,
      values: VOLUME_STEPS,
    },
    {
      id: "desktop_notifications",
      label: "Desktop notifications",
      description: "Show system notifications on task complete",
      currentValue: config.desktop_notifications ? "on" : "off",
      values: ["on", "off"],
    },
    {
      id: "silent_window_seconds",
      label: "Silent window",
      description: "Suppress task.complete for tasks shorter than N seconds",
      currentValue: `${config.silent_window_seconds}s`,
      values: ["0s", "1s", "2s", "3s", "5s", "10s", "15s", "30s"],
    },

  ];

  for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
    items.push({
      id: `cat:${cat}`,
      label,
      currentValue: config.categories[cat] !== false ? "on" : "off",
      values: ["on", "off"],
    });
  }

  items.push({
    id: "preview",
    label: "Preview sound",
    currentValue: "▶",
    values: ["▶"],
  });

  return items;
}

function isPrintableSearchChar(data: string): boolean {
  return data.length === 1 && data >= " " && data !== "\u007f";
}

async function promptInstallSelection(
  ctx: { ui: { custom: any } },
  registry: Registry,
  preferredLanguages: string[],
): Promise<string[] | null> {
  return ctx.ui.custom((tui: any, theme: any, _kb: any, done: (r: string[] | null) => void) => {
    const localePackNames = selectLocaleInstallPackNames(registry, preferredLanguages);
    const sortedPacks = sortRegistryPacksForLocale(registry, preferredLanguages);
    const items = [
      ...(localePackNames.length > 0
        ? [{
            value: "__locale__",
            label: `Install locale-aware packs (${localePackNames.length})`,
            description: preferredLanguages.join(", "),
          }]
        : []),
      {
        value: "__defaults__",
        label: `Install starter packs (${DEFAULT_PACK_NAMES.length})`,
        description: "Original curated bundle",
      },
      ...sortedPacks.map((pack) => ({
        value: pack.name,
        label: buildRegistryPackLabel(pack),
        description: buildRegistryPackDescription(pack) || pack.description || undefined,
      })),
    ];

    const list = new SelectList(items, Math.min(Math.max(items.length, 1), REGISTRY_PICKER_DEFAULT_VISIBLE), {
      selectedPrefix: (t: string) => theme.fg("accent", t),
      selectedText: (t: string) => theme.fg("accent", t),
      description: (t: string) => theme.fg("muted", t),
      scrollInfo: (t: string) => theme.fg("dim", t),
      noMatch: (t: string) => theme.fg("warning", t),
    });

    let query = "";
    const setFilter = () => {
      list.setFilter(query.trim());
      list.invalidate();
      tui.requestRender();
    };

    list.onSelect = (item) => {
      if (item.value === "__locale__") {
        done(localePackNames);
        return;
      }
      if (item.value === "__defaults__") {
        done([...DEFAULT_PACK_NAMES]);
        return;
      }
      done([item.value]);
    };
    list.onCancel = () => done(null);

    return {
      render(width: number) {
        return [
          theme.fg("accent", "OpenPeon packs"),
          theme.fg("muted", `Locale priority: ${preferredLanguages.join(", ") || "system default"}`),
          theme.fg("muted", `Search: ${query || "type to filter packs"}`),
          ...list.render(width),
          theme.fg("dim", "Type to filter • ↑↓ navigate • enter install • esc cancel"),
        ];
      },
      invalidate() {
        list.invalidate();
      },
      handleInput(data: string) {
        if (data === "\u007f" || data === "\b") {
          if (query.length > 0) {
            query = query.slice(0, -1);
            setFilter();
          }
          return;
        }
        if (data === "\u0015") {
          query = "";
          setFilter();
          return;
        }
        if (isPrintableSearchChar(data)) {
          query += data;
          setFilter();
          return;
        }
        list.handleInput(data);
        tui.requestRender();
      },
    };
  });
}

async function installSelectedPacks(
  names: string[],
  registry: Registry | null,
  ctx: { ui: { custom: any; notify: (msg: string, level: "info" | "warning" | "error") => void } },
  onInstallStart: () => void,
  onInstallEnd: () => void,
): Promise<{ installed: number; total: number } | null> {
  if (names.length === 0) return { installed: 0, total: 0 };

  return ctx.ui.custom(
    (tui: any, theme: any, _kb: any, done: (r: { installed: number; total: number } | null) => void) => {
      const container = new Container();
      const borderColor = (s: string) => theme.fg("border", s);

      container.addChild(new DynamicBorder(borderColor));

      const loader = new CancellableLoader(
        tui,
        (s: string) => theme.fg("accent", s),
        (s: string) => theme.fg("muted", s),
        "Preparing pack install...",
      );
      container.addChild(loader);

      container.addChild(new Spacer(1));
      container.addChild(new Text(keyHint("selectCancel", "cancel"), 1, 0));
      container.addChild(new Spacer(1));
      container.addChild(new DynamicBorder(borderColor));

      loader.onAbort = () => done(null);

      const doInstall = async () => {
        onInstallStart();

        let installed = 0;
        for (let i = 0; i < names.length; i += 1) {
          if (loader.aborted) break;

          const name = names[i];
          loader.setMessage(`[${i + 1}/${names.length}] ${name}: downloading...`);

          const ok = await downloadPack(name, registry, (msg) => {
            if (!loader.aborted) loader.setMessage(`[${i + 1}/${names.length}] ${msg}`);
          });
          if (ok) installed += 1;
        }

        if (installed > 0) {
          const config = loadConfig();
          if (!listPacks().find((p) => p.name === config.default_pack)) {
            config.default_pack = names[0];
            saveConfig(config);
          }
        }

        done({ installed, total: names.length });
      };

      doInstall()
        .catch(() => done(null))
        .finally(() => { onInstallEnd(); });

      return container;
    },
  );
}

export async function runInstall(
  packNames: string[],
  ctx: { ui: { custom: any; notify: (msg: string, level: "info" | "warning" | "error") => void } },
  onInstallStart: () => void,
  onInstallEnd: () => void,
): Promise<void> {
  const preferredLanguages = detectPreferredLanguageTags();
  const registry = await fetchRegistry();

  let names = resolveRequestedPackNames(packNames, registry, preferredLanguages);
  if (names === null) {
    if (!registry) {
      names = [...DEFAULT_PACK_NAMES];
    } else {
      names = await promptInstallSelection(ctx, registry, preferredLanguages);
    }
  }

  if (!names) {
    ctx.ui.notify("peon-ping: install cancelled", "info");
    return;
  }

  if (names.length === 0) {
    ctx.ui.notify("peon-ping: no locale-aware packs found for this system", "warning");
    return;
  }

  const result = await installSelectedPacks(names, registry, ctx, onInstallStart, onInstallEnd);

  if (result) {
    ctx.ui.notify(
      `peon-ping: installed ${result.installed}/${result.total} packs`,
      result.installed > 0 ? "info" : "error",
    );
  } else {
    ctx.ui.notify("peon-ping: install cancelled", "info");
  }
}

export function createSettingsPanel(
  tui: any,
  _theme: any,
  _kb: any,
  done: (val: undefined) => void,
): Component {
  const container = new Container();
  container.addChild(new DynamicBorder((s: string) => s));

  const items = buildSettingsItems();

  const settingsList = new SettingsList(
    items,
    Math.min(items.length + 2, 18),
    getSettingsListTheme(),
    (id, newValue) => {
      if (id === "sounds") {
        const state = loadState();
        state.paused = newValue === "paused";
        saveState(state);
      } else if (id === "relay_mode") {
        const config = loadConfig();
        config.relay_mode = newValue as RelayMode;
        saveConfig(config);
      } else if (id === "desktop_notifications") {
        const config = loadConfig();
        config.desktop_notifications = newValue === "on";
        saveConfig(config);
      } else if (id === "volume") {
        const config = loadConfig();
        config.volume = parseInt(newValue, 10) / 100;
        saveConfig(config);
      } else if (id.startsWith("cat:")) {
        const cat = id.slice(4);
        const config = loadConfig();
        config.categories[cat] = newValue === "on";
        saveConfig(config);
      } else if (id === "silent_window_seconds") {
        const config = loadConfig();
        config.silent_window_seconds = parseInt(newValue, 10);
        saveConfig(config);
      } else if (id === "preview") {
        const config = loadConfig();
        const state = loadState();
        const sound = pickSound("session.start", config, state);
        if (sound) {
          playSound(sound.file, config.volume);
          saveState(state);
        }
      }
    },
    () => done(undefined),
  );

  container.addChild(settingsList);
  container.addChild(new DynamicBorder((s: string) => s));

  return {
    render(width: number) { return container.render(width); },
    invalidate() { container.invalidate(); },
    handleInput(data: string) {
      settingsList.handleInput?.(data);
      tui.requestRender();
    },
  };
}
