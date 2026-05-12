import { describe, it, expect } from "bun:test";
import { DEFAULT_PACK_NAMES } from "../src/constants";
import {
  buildRegistryPackDescription,
  buildRegistryPackLabel,
  getLocaleMatchScore,
  resolveRequestedPackNames,
  selectLocaleInstallPackNames,
  sortRegistryPacksForLocale,
} from "../src/install-options";
import {
  getPreferredLanguageTags,
  normalizeLanguageTag,
  parseAppleLanguagesOutput,
} from "../src/locale";
import type { Registry } from "../src/types";

describe("locale helpers", () => {
  it("normalizes locale strings", () => {
    expect(normalizeLanguageTag("de_DE.UTF-8")).toBe("de-de");
    expect(normalizeLanguageTag("en_US@rg=dezzzz")).toBe("en-us");
    expect(normalizeLanguageTag("C")).toBeNull();
  });

  it("parses AppleLanguages output in preference order", () => {
    const output = `(\n    \"en-US\",\n    \"de-DE\"\n)`;
    expect(parseAppleLanguagesOutput(output)).toEqual(["en-us", "en", "de-de", "de"]);
  });

  it("combines env and runtime locale preferences without duplicates", () => {
    const tags = getPreferredLanguageTags(
      { LANGUAGE: "fr_FR:de_DE", LANG: "de_DE.UTF-8" },
      "en-US",
    );

    expect(tags).toEqual(["fr-fr", "fr", "de-de", "de", "en-us", "en"]);
  });
});

describe("registry install options", () => {
  const registry: Registry = {
    packs: [
      {
        name: "peon",
        display_name: "Warcraft III Peon",
        language: "en",
        trust_tier: "official",
        sound_count: 30,
      },
      {
        name: "acolyte_de",
        display_name: "Undead Acolyte (DE)",
        language: "de",
        trust_tier: "official",
        sound_count: 31,
      },
      {
        name: "peon_de",
        display_name: "Orc Peon (DE)",
        language: "de",
        trust_tier: "official",
        sound_count: 27,
      },
      {
        name: "stromberg",
        display_name: "Bernd Stromberg",
        language: "de",
        trust_tier: "community",
        sound_count: 22,
        author: { name: "heikodoes" },
      },
      {
        name: "alan-rickman",
        display_name: "Alan Rickman",
        language: "en",
        trust_tier: "verified",
        sound_count: 60,
      },
      {
        name: "aoe2",
        display_name: "Age of Empires II Taunts",
        language: "en",
        trust_tier: "official",
        sound_count: 42,
      },
      {
        name: "kiku",
        display_name: "Kiku",
        language: "zh-CN",
        trust_tier: "community",
        sound_count: 37,
      },
    ],
  };

  it("scores exact locale matches above base-language and non-matches", () => {
    expect(getLocaleMatchScore(registry.packs[1], ["de-de", "de", "en-us", "en"]))
      .toBeGreaterThan(getLocaleMatchScore(registry.packs[4], ["de-de", "de", "en-us", "en"]));
    expect(getLocaleMatchScore(registry.packs[6], ["de-de", "de", "en-us", "en"]))
      .toBe(-1);
  });

  it("returns all locale-aware packs in locale-first order", () => {
    expect(selectLocaleInstallPackNames(registry, ["de-de", "de", "en-us", "en"]))
      .toEqual(["acolyte_de", "peon_de", "stromberg", "aoe2", "peon", "alan-rickman"]);
  });

  it("sorts the full registry with locale and trust priority", () => {
    const sorted = sortRegistryPacksForLocale(registry, ["de-de", "de"]);
    expect(sorted.slice(0, 4).map((pack) => pack.name)).toEqual(["acolyte_de", "peon_de", "stromberg", "aoe2"]);
  });

  it("resolves install shortcuts", () => {
    expect(resolveRequestedPackNames(["defaults"], registry, ["de-de", "de"]))
      .toEqual(DEFAULT_PACK_NAMES);
    expect(resolveRequestedPackNames(["locale"], registry, ["de-de", "de"]))
      .toEqual(["acolyte_de", "peon_de", "stromberg"]);
    expect(resolveRequestedPackNames(["peon_de", "stromberg"], registry, ["de-de", "de"]))
      .toEqual(["peon_de", "stromberg"]);
    expect(resolveRequestedPackNames([], registry, ["de-de", "de"]))
      .toBeNull();
  });

  it("formats searchable pack labels and descriptions", () => {
    expect(buildRegistryPackLabel(registry.packs[1])).toBe("Undead Acolyte (DE) (acolyte_de) · de");
    expect(buildRegistryPackDescription(registry.packs[3])).toBe("community · 22 sounds · heikodoes");
  });
});
