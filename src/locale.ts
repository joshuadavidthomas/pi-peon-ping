import { execFileSync } from "node:child_process";
import { detectPlatform } from "./platform";

function readAppleLanguages(): string {
  if (detectPlatform() !== "mac") return "";
  try {
    return execFileSync("defaults", ["read", "-g", "AppleLanguages"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

/** Base language codes ("de", "en", ...) from the system settings, most preferred first. */
export function detectLanguages(
  env: Record<string, string | undefined> = process.env,
  runtimeLocale: string = Intl.DateTimeFormat().resolvedOptions().locale,
  appleLanguages: string = readAppleLanguages(),
): string[] {
  const sources = [
    ...appleLanguages.split("\n"),
    ...(env.LANGUAGE ?? "").split(":"),
    env.LC_ALL,
    env.LC_MESSAGES,
    env.LANG,
    runtimeLocale,
  ];
  const languages = sources.map((source) => source?.match(/^\s*"?([a-z]{2,3})(?![a-z])/i)?.[1].toLowerCase());
  return [...new Set(languages.filter((language): language is string => language !== undefined && language !== "und"))];
}
