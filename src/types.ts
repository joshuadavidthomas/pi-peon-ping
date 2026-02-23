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

export interface PeonConfig {
  active_pack: string;
  volume: number;
  enabled: boolean;
  desktop_notifications: boolean;
  categories: Record<string, boolean>;
  annoyed_threshold: number;
  annoyed_window_seconds: number;
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
