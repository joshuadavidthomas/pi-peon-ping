import { DEFAULT_PACK_NAMES } from "./constants";
import { normalizeLanguageTag } from "./locale";
import type { Registry, RegistryPack, TrustTier } from "./types";

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
