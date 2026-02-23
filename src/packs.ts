import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { LEGACY_PACKS, PACKS_DIR, FALLBACK_REPO, FALLBACK_REF, REGISTRY_URL } from "./constants";
import type { PackManifest, PeonConfig, PeonState, Registry, RegistryPack } from "./types";

export function getPacksDir(): string {
  if (existsSync(PACKS_DIR) && readdirSync(PACKS_DIR).length > 0) return PACKS_DIR;
  if (existsSync(LEGACY_PACKS) && readdirSync(LEGACY_PACKS).length > 0) return LEGACY_PACKS;
  return PACKS_DIR;
}

export function listPacks(): { name: string; displayName: string; path: string }[] {
  const packsDir = getPacksDir();
  if (!existsSync(packsDir)) return [];

  const packs: { name: string; displayName: string; path: string }[] = [];
  for (const dir of readdirSync(packsDir)) {
    const packPath = join(packsDir, dir);
    const manifest = loadManifest(packPath);
    if (manifest) {
      packs.push({
        name: manifest.name || dir,
        displayName: manifest.display_name || manifest.name || dir,
        path: packPath,
      });
    }
  }
  return packs.sort((a, b) => a.name.localeCompare(b.name));
}

export function loadManifest(packPath: string): PackManifest | null {
  for (const name of ["openpeon.json", "manifest.json"]) {
    const p = join(packPath, name);
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, "utf8"));
      } catch {}
    }
  }
  return null;
}

export function pickSound(
  category: string,
  config: PeonConfig,
  state: PeonState,
): { file: string; label: string } | null {
  if (!config.categories[category]) return null;

  const packsDir = getPacksDir();
  const packPath = join(packsDir, config.active_pack);
  const manifest = loadManifest(packPath);
  if (!manifest) return null;

  const catData = manifest.categories[category];
  if (!catData?.sounds?.length) return null;

  const sounds = catData.sounds;
  const lastFile = state.last_played[category];

  let candidates = sounds.length > 1 ? sounds.filter((s) => s.file !== lastFile) : sounds;
  if (candidates.length === 0) candidates = sounds;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];

  const file = pick.file.includes("/")
    ? join(packPath, pick.file)
    : join(packPath, "sounds", pick.file);

  if (!existsSync(file)) return null;

  state.last_played[category] = pick.file;
  return { file, label: pick.label || basename(pick.file) };
}

export async function fetchRegistry(): Promise<Registry | null> {
  try {
    const resp = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    return (await resp.json()) as Registry;
  } catch {
    return null;
  }
}

async function downloadFile(url: string, destPath: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return false;
    const buf = Buffer.from(await resp.arrayBuffer());
    await writeFile(destPath, buf);
    return true;
  } catch {
    return false;
  }
}

export async function downloadPack(
  packName: string,
  registry: Registry | null,
  onProgress?: (msg: string) => void,
): Promise<boolean> {
  const packDir = join(PACKS_DIR, packName);
  const soundsDir = join(packDir, "sounds");
  await mkdir(soundsDir, { recursive: true });

  let sourceRepo = FALLBACK_REPO;
  let sourceRef = FALLBACK_REF;
  let sourcePath = packName;

  if (registry) {
    const entry = registry.packs.find((p: RegistryPack) => p.name === packName);
    if (entry) {
      sourceRepo = entry.source_repo || FALLBACK_REPO;
      sourceRef = entry.source_ref || FALLBACK_REF;
      sourcePath = entry.source_path || packName;
    }
  }

  const baseUrl = `https://raw.githubusercontent.com/${sourceRepo}/${sourceRef}/${sourcePath}`;

  onProgress?.(`${packName}: manifest...`);
  const manifestPath = join(packDir, "openpeon.json");
  if (!(await downloadFile(`${baseUrl}/openpeon.json`, manifestPath))) {
    onProgress?.(`${packName}: ✗ manifest failed`);
    return false;
  }

  let manifestData: PackManifest;
  try {
    manifestData = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    onProgress?.(`${packName}: ✗ bad manifest`);
    return false;
  }

  const seenFiles = new Set<string>();
  for (const cat of Object.values(manifestData.categories)) {
    for (const sound of cat.sounds) {
      seenFiles.add(basename(sound.file));
    }
  }

  const filenames = Array.from(seenFiles);
  let downloaded = 0;

  for (let i = 0; i < filenames.length; i += 5) {
    const batch = filenames.slice(i, i + 5);
    const results = await Promise.all(
      batch.map((f) => downloadFile(`${baseUrl}/sounds/${f}`, join(soundsDir, f))),
    );
    downloaded += results.filter(Boolean).length;
  }

  onProgress?.(`${packName}: ${downloaded}/${filenames.length} sounds`);
  return downloaded > 0;
}
