import { execSync } from "node:child_process";
import { detectPlatform } from "./platform";

function cleanLocaleToken(value: string): string {
  return value
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/\.UTF-?8$/i, "")
    .replace(/\.utf-?8$/i, "")
    .replace(/@.*$/, "")
    .replace(/_/g, "-")
    .toLowerCase();
}

export function normalizeLanguageTag(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = cleanLocaleToken(value);
  if (!cleaned || cleaned === "c" || cleaned === "posix") return null;
  return cleaned;
}

export function expandLanguageTag(value: string | null | undefined): string[] {
  const normalized = normalizeLanguageTag(value);
  if (!normalized) return [];

  const [base] = normalized.split("-");
  return normalized === base ? [base] : [normalized, base];
}

export function parseAppleLanguagesOutput(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('"'))
    .flatMap((line) => expandLanguageTag(line.replace(/[",]/g, "")));
}

export function getPreferredLanguageTags(
  env: Record<string, string | undefined> = process.env,
  runtimeLocale: string = Intl.DateTimeFormat().resolvedOptions().locale,
  appleLanguagesOutput?: string,
): string[] {
  const values: string[] = [];

  if (appleLanguagesOutput) {
    values.push(...parseAppleLanguagesOutput(appleLanguagesOutput));
  }

  if (env.LANGUAGE) {
    for (const token of env.LANGUAGE.split(":")) values.push(...expandLanguageTag(token));
  }

  for (const key of ["LC_ALL", "LC_MESSAGES", "LANG"]) {
    if (env[key]) values.push(...expandLanguageTag(env[key]));
  }

  values.push(...expandLanguageTag(runtimeLocale));

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }

  return ordered;
}

export function detectPreferredLanguageTags(): string[] {
  let appleLanguagesOutput: string | undefined;

  if (detectPlatform() === "mac") {
    try {
      appleLanguagesOutput = execSync("defaults read -g AppleLanguages", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {}
  }

  return getPreferredLanguageTags(process.env, Intl.DateTimeFormat().resolvedOptions().locale, appleLanguagesOutput);
}
