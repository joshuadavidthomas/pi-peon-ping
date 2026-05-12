import { DEFAULT_PACK_NAMES } from "./constants";
import { normalizeLanguageTag } from "./locale";
import type { Registry, RegistryPack, TrustTier } from "./types";

export const INSTALL_PICKER_LOCALE_VALUE = "__locale__";
export const INSTALL_PICKER_DEFAULTS_VALUE = "__defaults__";

const TRUST_RANK: Record<string, number> = {
  official: 0,
  verified: 1,
  community: 2,
};

function getBaseLanguage(value: string | null): string | null {
  if (!value) return null;
  return value.split("-")[0] || null;
}

export function getLocaleMatchScore(pack: RegistryPack, preferredLanguages: string[]): number {
  const packLanguage = normalizeLanguageTag(pack.language);
  if (!packLanguage) return -1;

  const packBase = getBaseLanguage(packLanguage);
  let best = -1;

  for (let index = 0; index < preferredLanguages.length; index += 1) {
    const preferred = normalizeLanguageTag(preferredLanguages[index]);
    if (!preferred) continue;

    if (packLanguage === preferred) {
      best = Math.max(best, 1000 - index);
      continue;
    }

    const preferredBase = getBaseLanguage(preferred);
    if (packBase && preferredBase && packBase === preferredBase) {
      best = Math.max(best, 500 - index);
    }
  }

  return best;
}

export function isLocaleAwarePack(pack: RegistryPack, preferredLanguages: string[]): boolean {
  return getLocaleMatchScore(pack, preferredLanguages) >= 0;
}

export function sortRegistryPacksForLocale(registry: Registry, preferredLanguages: string[]): RegistryPack[] {
  return [...registry.packs].sort((a, b) => {
    const localeDiff = getLocaleMatchScore(b, preferredLanguages) - getLocaleMatchScore(a, preferredLanguages);
    if (localeDiff !== 0) return localeDiff;

    const trustDiff = (TRUST_RANK[a.trust_tier || "community"] ?? 9)
      - (TRUST_RANK[b.trust_tier || "community"] ?? 9);
    if (trustDiff !== 0) return trustDiff;

    const soundDiff = (b.sound_count || 0) - (a.sound_count || 0);
    if (soundDiff !== 0) return soundDiff;

    const aName = (a.display_name || a.name).toLowerCase();
    const bName = (b.display_name || b.name).toLowerCase();
    return aName.localeCompare(bName);
  });
}

export function selectLocaleInstallPackNames(
  registry: Registry | null,
  preferredLanguages: string[],
): string[] {
  if (!registry) return [];

  return sortRegistryPacksForLocale(registry, preferredLanguages)
    .filter((pack) => isLocaleAwarePack(pack, preferredLanguages))
    .map((pack) => pack.name);
}

function getPackSearchText(pack: RegistryPack): string {
  return [
    pack.name,
    pack.display_name,
    pack.language,
    pack.description,
    ...(pack.tags || []),
    pack.author?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getSearchScore(pack: RegistryPack, query: string): number {
  const loweredQuery = query.trim().toLowerCase();
  if (!loweredQuery) return 0;

  const name = pack.name.toLowerCase();
  const displayName = (pack.display_name || "").toLowerCase();
  const searchText = getPackSearchText(pack);

  if (name === loweredQuery) return 4000;
  if (displayName === loweredQuery) return 3900;
  if (name.startsWith(loweredQuery)) return 3000;
  if (displayName.startsWith(loweredQuery)) return 2900;
  if (searchText.includes(loweredQuery)) return 2000;

  const tokens = loweredQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  if (tokens.every((token) => searchText.includes(token))) return 1000;

  return -1;
}

export function filterRegistryPacks(
  registry: Registry,
  preferredLanguages: string[],
  query: string,
): RegistryPack[] {
  return sortRegistryPacksForLocale(registry, preferredLanguages)
    .map((pack) => ({ pack, score: getSearchScore(pack, query) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return 0;
    })
    .map((entry) => entry.pack);
}

export function toggleSelectedPackName(selectedNames: string[], packName: string): string[] {
  return selectedNames.includes(packName)
    ? selectedNames.filter((name) => name !== packName)
    : [...selectedNames, packName];
}

export function resolvePickerInstallNames(
  selectedNames: string[],
  highlightedValue: string | null,
  localePackNames: string[],
): string[] {
  if (selectedNames.length > 0) return [...selectedNames];
  if (highlightedValue === INSTALL_PICKER_LOCALE_VALUE) return [...localePackNames];
  if (highlightedValue === INSTALL_PICKER_DEFAULTS_VALUE) return [...DEFAULT_PACK_NAMES];
  if (!highlightedValue) return [];
  return [highlightedValue];
}

export function resolveRequestedPackNames(
  requested: string[],
  registry: Registry | null,
  preferredLanguages: string[],
): string[] | null {
  if (requested.length === 0) return null;

  if (requested.length === 1 && requested[0] === "defaults") {
    return [...DEFAULT_PACK_NAMES];
  }

  if (requested.length === 1 && requested[0] === "locale") {
    return selectLocaleInstallPackNames(registry, preferredLanguages);
  }

  return requested;
}

export function buildRegistryPackLabel(pack: RegistryPack): string {
  const name = pack.display_name || pack.name;
  const language = pack.language ? ` · ${pack.language}` : "";
  return `${name} (${pack.name})${language}`;
}

export function buildRegistryPackDescription(pack: RegistryPack): string {
  const parts = [
    pack.trust_tier,
    pack.sound_count ? `${pack.sound_count} sounds` : undefined,
    pack.author?.name,
  ].filter(Boolean);

  return parts.join(" · ");
}

export function getTrustLabel(trustTier: TrustTier | undefined): string {
  if (!trustTier) return "community";
  return trustTier;
}
