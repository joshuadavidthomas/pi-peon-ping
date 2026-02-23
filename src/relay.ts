import type { RelayMode } from "./types";

export type RemoteSessionType = "ssh" | "devcontainer" | "codespaces";

export interface RemoteSession {
  type: RemoteSessionType;
  relayUrl: string;
}

const DEFAULT_RELAY_PORT = "19998";

export function detectSessionType(): RemoteSessionType | null {
  if (process.env.CODESPACES) return "codespaces";
  if (process.env.REMOTE_CONTAINERS) return "devcontainer";
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY || process.env.SSH_CLIENT) return "ssh";
  return null;
}

export function detectRemoteSession(): RemoteSession | null {
  if (process.env.PEON_RELAY_URL) {
    const type = detectSessionType() || "ssh";
    return { type, relayUrl: process.env.PEON_RELAY_URL };
  }

  const type = detectSessionType();
  if (!type) return null;

  const port = process.env.PEON_RELAY_PORT || DEFAULT_RELAY_PORT;
  const defaultHost = type === "ssh" ? "127.0.0.1" : "host.docker.internal";
  const host = process.env.PEON_RELAY_HOST || defaultHost;

  return { type, relayUrl: `http://${host}:${port}` };
}

export function getRelayUrl(relayMode: RelayMode): string | null {
  if (relayMode === "local") return null;

  const session = detectRemoteSession();
  if (session) return session.relayUrl;

  if (relayMode === "relay") {
    const host = process.env.PEON_RELAY_HOST || "127.0.0.1";
    const port = process.env.PEON_RELAY_PORT || DEFAULT_RELAY_PORT;
    return `http://${host}:${port}`;
  }

  return null;
}

export async function checkRelayHealth(relayUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(`${relayUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function relayPlayCategory(relayUrl: string, category: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `${relayUrl}/play?category=${encodeURIComponent(category)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    return resp.ok;
  } catch {
    return false;
  }
}

export async function relayNotify(relayUrl: string, title: string, body: string): Promise<boolean> {
  try {
    const resp = await fetch(`${relayUrl}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export function relaySetupInstructions(session: RemoteSession): string {
  let port = DEFAULT_RELAY_PORT;
  try {
    port = new URL(session.relayUrl).port || DEFAULT_RELAY_PORT;
  } catch {}

  switch (session.type) {
    case "ssh":
      return `Run 'peon relay --daemon' locally, then SSH with '-R ${port}:localhost:${port}'`;
    case "devcontainer":
      return "Run 'peon relay --daemon' on your host machine";
    case "codespaces":
      return "Run 'peon relay --daemon' on your host machine";
  }
}
