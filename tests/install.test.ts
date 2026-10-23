import { describe, expect, it } from "bun:test";
import { initTheme } from "@mariozechner/pi-coding-agent";
import { visibleWidth } from "@mariozechner/pi-tui";
import { detectLanguages } from "../src/locale";
import { createInstallPicker } from "../src/ui";
import type { Registry } from "../src/types";

const DOWN = "\x1b[B";
const UP = "\x1b[A";
const ENTER = "\r";
const ESC = "\x1b";
const SPACE = " ";
const CTRL_U = "\x15";

const registry: Registry = {
  packs: [
    { name: "peon", language: "en", trust_tier: "official", sound_count: 27 },
    { name: "peon_de", language: "de", trust_tier: "community", sound_count: 10 },
    { name: "acolyte_de", language: "de-DE", trust_tier: "official", sound_count: 5 },
    { name: "glados", language: "en", trust_tier: "official", sound_count: 40 },
    { name: "peon_ru", language: "en,ru", trust_tier: "community", sound_count: 3 },
  ],
};

initTheme("dark");

function pick(languages: string[], keys: string[]): string[] | null | undefined {
  let result: string[] | null | undefined;
  const plain = { fg: (_color: string, text: string) => text, bold: (text: string) => text };
  const picker = createInstallPicker(registry, languages, plain, (names) => {
    result = names;
  });
  for (const key of keys) picker.handleInput?.(key);
  return result;
}

describe("install picker", () => {
  it("installs the highlighted pack when nothing is ticked, ranked by language then trust tier", () => {
    expect(pick(["de", "en"], [ENTER])).toEqual(["acolyte_de"]);
    expect(pick(["en"], [ENTER])).toEqual(["glados"]);
    expect(pick(["ru"], [ENTER])).toEqual(["peon_ru"]);
  });

  it("installs exactly the ticked packs", () => {
    expect(pick(["de", "en"], [SPACE, DOWN, DOWN, SPACE, ENTER])).toEqual(["acolyte_de", "glados"]);
    expect(pick(["de", "en"], [SPACE, DOWN, SPACE, UP, SPACE, ENTER])).toEqual(["peon_de"]);
  });

  it("keeps ticks across searches", () => {
    expect(pick(["en"], ["r", "u", SPACE, CTRL_U, ENTER])).toEqual(["peon_ru"]);
  });

  it("does nothing on enter when the search matches nothing and nothing is ticked", () => {
    expect(pick(["en"], ["z", "z", ENTER])).toBeUndefined();
  });

  it("cancels on escape", () => {
    expect(pick(["en"], [SPACE, ESC])).toBeNull();
  });

  it("fits every line in a narrow terminal", () => {
    const longPack: Registry = { packs: [{ name: "lol_fiddlesticks_surprise_party", language: "en", sound_count: 33 }] };
    const plain = { fg: (_color: string, text: string) => text, bold: (text: string) => text };
    const picker = createInstallPicker(longPack, ["de", "en", "fr", "pt", "ja"], plain, () => {});
    const widths = picker.render(30).map((line) => visibleWidth(line));
    expect(widths.filter((width) => width > 30)).toEqual([]);
  });
});

describe("detectLanguages", () => {
  it("orders base languages by macOS, LANGUAGE, LC_*, LANG, then runtime locale", () => {
    const appleLanguages = `(\n    "de-DE",\n    en\n)\n`;
    expect(
      detectLanguages({ LANGUAGE: "fr_FR:pt_BR", LC_ALL: "C.UTF-8", LANG: "POSIX" }, "ja-JP", appleLanguages),
    ).toEqual(["de", "en", "fr", "pt", "ja"]);
  });

  it("ignores the undetermined locale Node reports when none is configured", () => {
    expect(detectLanguages({ LANG: "de_DE.UTF-8" }, "und", "")).toEqual(["de"]);
  });
});
