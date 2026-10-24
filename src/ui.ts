import { BorderedLoader, DynamicBorder, getSettingsListTheme, rawKeyHint } from "@earendil-works/pi-coding-agent";
import {
  CancellableLoader,
  Container,
  Input,
  matchesKey,
  type Component,
  type Focusable,
  type SettingItem,
  SettingsList,
  SelectList,
  Spacer,
  Text,
  truncateToWidth,
} from "@earendil-works/pi-tui";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { killPreviousSound, playSound } from "./audio";
import { loadConfig, loadState, saveConfig, saveState } from "./config";
import { CATEGORY_LABELS, DEFAULT_PACK_NAMES, VOLUME_STEPS } from "./constants";
import { detectLanguages } from "./locale";
import { downloadPack, fetchRegistry, getPacksDir, listPacks, loadManifest, pickSound } from "./packs";
import { detectRemoteSession, getRelayUrl } from "./relay";
import type { Registry, RegistryPack, RelayMode } from "./types";

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
      label: label,
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

export function createInstallPicker(
  registry: Registry,
  languages: string[],
  theme: { fg(color: string, text: string): string; bold(text: string): string },
  done: (names: string[] | null) => void,
): Component & Focusable {
  const languageRank = (pack: RegistryPack) => {
    const ranks = (pack.language ?? "").split(",").map((language) => {
      const index = languages.indexOf(language.trim().split("-")[0].toLowerCase());
      return index < 0 ? Infinity : index;
    });
    return Math.min(...ranks);
  };
  const trustRank = (pack: RegistryPack) => ({ official: 0, verified: 1 })[pack.trust_tier ?? ""] ?? 2;

  const packs = [...registry.packs].sort((a, b) =>
    languageRank(a) - languageRank(b)
    || trustRank(a) - trustRank(b)
    || (b.sound_count ?? 0) - (a.sound_count ?? 0)
    || a.name.localeCompare(b.name));

  const border = new DynamicBorder((s: string) => theme.fg("border", s));
  const search = new Input();
  const selected = new Set<string>();
  const maxVisible = 10;
  let filtered = packs;
  let index = 0;

  const filter = () => {
    const query = search.getValue().trim().toLowerCase();
    filtered = packs.filter((pack) =>
      [pack.name, pack.display_name, pack.language, pack.description, pack.author?.name, ...(pack.tags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(query));
    index = 0;
  };

  return {
    get focused() {
      return search.focused;
    },
    set focused(value: boolean) {
      search.focused = value;
    },
    render(width: number) {
      const lines = [
        ...border.render(width),
        "",
        theme.fg("accent", theme.bold("Install sound packs")),
        truncateToWidth(theme.fg("muted", `Packs in ${languages.join(", ") || "your language"} first`), width, "…"),
        "",
        ...search.render(width),
        "",
      ];
      const highlighted = filtered[index];
      if (!highlighted) {
        lines.push(theme.fg("muted", "  No matching packs"));
      } else {
        const start = Math.max(0, Math.min(index - Math.floor(maxVisible / 2), filtered.length - maxVisible));
        filtered.slice(start, start + maxVisible).forEach((pack, offset) => {
          const active = start + offset === index;
          const box = selected.has(pack.name) ? theme.fg("success", "[x]") : theme.fg("dim", "[ ]");
          const name = pack.display_name || pack.name;
          lines.push(truncateToWidth(
            `${active ? theme.fg("accent", "→ ") : "  "}${box} ${active ? theme.fg("accent", name) : name}`,
            width,
            "…",
          ));
        });
        if (filtered.length > maxVisible) lines.push(theme.fg("muted", `  (${index + 1}/${filtered.length})`));
        lines.push("");
        if (highlighted.description) lines.push(truncateToWidth(theme.fg("muted", `  ${highlighted.description}`), width, "…"));
        lines.push(truncateToWidth(
          theme.fg("dim", `  ${highlighted.name}, ${highlighted.language ?? "unknown language"}, ${highlighted.sound_count ?? 0} sounds`),
          width,
          "…",
        ));
      }
      lines.push(
        "",
        truncateToWidth(theme.fg("dim", `  ↑↓ navigate · space toggle · enter install · esc cancel · ${selected.size} selected`), width, "…"),
        ...border.render(width),
      );
      return lines;
    },
    invalidate() {
      border.invalidate();
      search.invalidate();
    },
    handleInput(data: string) {
      const highlighted = filtered[index];
      if (matchesKey(data, "escape")) {
        done(null);
      } else if (matchesKey(data, "ctrl+c")) {
        if (!search.getValue()) return done(null);
        search.setValue("");
        filter();
      } else if (matchesKey(data, "enter")) {
        if (selected.size > 0) done([...selected]);
        else if (highlighted) done([highlighted.name]);
      } else if (matchesKey(data, "up")) {
        if (filtered.length > 0) index = index === 0 ? filtered.length - 1 : index - 1;
      } else if (matchesKey(data, "down")) {
        if (filtered.length > 0) index = index === filtered.length - 1 ? 0 : index + 1;
      } else if (matchesKey(data, "space")) {
        if (highlighted && !selected.delete(highlighted.name)) selected.add(highlighted.name);
      } else {
        const before = search.getValue();
        search.handleInput(data);
        if (search.getValue() !== before) filter();
      }
    },
  };
}

export async function runInstall(
  packNames: string[],
  ctx: { ui: { custom: any; notify: (msg: string, level: "info" | "warning" | "error") => void } },
  onInstallStart: () => void,
  onInstallEnd: () => void,
): Promise<void> {
  let names = packNames.length === 1 && packNames[0] === "defaults" ? DEFAULT_PACK_NAMES : packNames;
  let registry: Registry | null | undefined;

  if (names.length === 0) {
    const fetched: Registry | null | "cancelled" = await ctx.ui.custom(
      (tui: any, theme: any, _kb: any, done: (r: Registry | null | "cancelled") => void) => {
        const loader = new BorderedLoader(tui, theme, "Fetching pack registry...");
        loader.onAbort = () => done("cancelled");
        fetchRegistry().then((result) => {
          if (!loader.signal.aborted) done(result);
        });
        return loader;
      },
    );
    if (fetched === "cancelled") {
      ctx.ui.notify("peon-ping: install cancelled", "info");
      return;
    }
    registry = fetched;

    if (!registry) {
      ctx.ui.notify("peon-ping: couldn't fetch the pack registry, installing starter packs", "warning");
      names = DEFAULT_PACK_NAMES;
    } else {
      const languages = detectLanguages();
      const picked: string[] | null = await ctx.ui.custom(
        (_tui: any, theme: any, _kb: any, done: (r: string[] | null) => void) =>
          createInstallPicker(registry!, languages, theme, done),
      );
      if (!picked) {
        ctx.ui.notify("peon-ping: install cancelled", "info");
        return;
      }
      names = picked;
    }
  }

  const result: { installed: number; total: number } | null = await ctx.ui.custom(
    (tui: any, theme: any, _kb: any, done: (r: { installed: number; total: number } | null) => void) => {
      const container = new Container();
      const borderColor = (s: string) => theme.fg("border", s);

      container.addChild(new DynamicBorder(borderColor));

      const loader = new CancellableLoader(
        tui,
        (s: string) => theme.fg("accent", s),
        (s: string) => theme.fg("muted", s),
        "Fetching pack registry...",
      );
      container.addChild(loader);

      container.addChild(new Spacer(1));
      container.addChild(new Text(rawKeyHint("escape/ctrl+c", "cancel"), 1, 0));
      container.addChild(new Spacer(1));
      container.addChild(new DynamicBorder(borderColor));

      loader.onAbort = () => done(null);

      const doInstall = async () => {
        onInstallStart();

        if (registry === undefined) registry = await fetchRegistry();
        if (loader.aborted) return;

        let installed = 0;
        for (let i = 0; i < names.length; i++) {
          if (loader.aborted) break;

          const name = names[i];
          loader.setMessage(`[${i + 1}/${names.length}] ${name}: downloading...`);

          const ok = await downloadPack(name, registry, (msg) => {
            if (!loader.aborted) loader.setMessage(`[${i + 1}/${names.length}] ${msg}`);
          });
          if (ok) installed++;
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
