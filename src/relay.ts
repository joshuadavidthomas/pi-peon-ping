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
  const port = process.env.PEON_RELAY_PORT || DEFAULT_RELAY_PORT;

  if (process.env.PEON_RELAY_URL) {
    const type = detectSessionType() || "ssh";
    return { type, relayUrl: process.env.PEON_RELAY_URL };
  }

  const customHost = process.env.PEON_RELAY_HOST;

  if (process.env.CODESPACES) {
    const host = customHost || "host.docker.internal";
    return { type: "codespaces", relayUrl: `http://${host}:${port}` };
  }

  if (process.env.REMOTE_CONTAINERS) {
    const host = customHost || "host.docker.internal";
    return { type: "devcontainer", relayUrl: `http://${host}:${port}` };
  }

  if (process.env.SSH_CONNECTION || process.env.SSH_TTY || process.env.SSH_CLIENT) {
    const host = customHost || "127.0.0.1";
    return { type: "ssh", relayUrl: `http://${host}:${port}` };
  }

  return null;
}

export function getRelayUrl(relayMode: "auto" | "local" | "relay"): string | null {
  if (relayMode === "local") return null;

  if (relayMode === "relay") {
    if (process.env.PEON_RELAY_URL) return process.env.PEON_RELAY_URL;
    const host = process.env.PEON_RELAY_HOST || "127.0.0.1";
    const port = process.env.PEON_RELAY_PORT || DEFAULT_RELAY_PORT;
    return `http://${host}:${port}`;
  }

  // Auto mode: use relay only when remote session detected
  const session = detectRemoteSession();
  return session?.relayUrl ?? null;
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

export function relaySetupInstructions(sessionType: RemoteSessionType): string {
  switch (sessionType) {
    case "ssh":
      return "Run 'peon relay --daemon' locally, then SSH with '-R 19998:localhost:19998'";
    case "devcontainer":
      return "Run 'peon relay --daemon' on your host machine";
    case "codespaces":
      return "Run 'peon relay --daemon' on your host machine";
  }
}
