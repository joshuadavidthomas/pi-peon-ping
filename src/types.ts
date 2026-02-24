export interface SoundEntry {
  file: string;
  label?: string;
}

export interface PackManifest {
  name: string;
  display_name?: string;
  categories: Record<string, { sounds: SoundEntry[] }>;
}

export type RelayMode = "auto" | "local" | "relay";
export type PackRotationMode = "random" | "round-robin";

export interface PathRule {
  pattern: string;
  pack: string;
}

export interface PeonConfig {
  default_pack: string;
  volume: number;
  enabled: boolean;
  desktop_notifications: boolean;
  categories: Record<string, boolean>;
  annoyed_threshold: number;
  annoyed_window_seconds: number;
  silent_window_seconds: number;
  suppress_subagent_complete: boolean;
  pack_rotation: string[];
  pack_rotation_mode: PackRotationMode;
  path_rules: PathRule[];
  session_ttl_days: number;
  headphones_only: boolean;
  relay_mode: RelayMode;
}

export interface PeonState {
  paused: boolean;
  last_played: Record<string, string>;
  prompt_timestamps: number[];
  last_stop_time: number;
  session_start_time: number;
}

export interface RegistryPack {
  name: string;
  source_repo?: string;
  source_ref?: string;
  source_path?: string;
}

export interface Registry {
  packs: RegistryPack[];
}
