import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  detectSessionType,
  detectRemoteSession,
  getRelayUrl,
  relaySetupInstructions,
} from "../src/relay";

const REMOTE_ENV_KEYS = [
  "SSH_CONNECTION", "SSH_TTY", "SSH_CLIENT",
  "REMOTE_CONTAINERS", "CODESPACES",
  "PEON_RELAY_URL", "PEON_RELAY_HOST", "PEON_RELAY_PORT",
];

function clearRemoteEnv(): Record<string, string | undefined> {
  const originals: Record<string, string | undefined> = {};
  for (const key of REMOTE_ENV_KEYS) {
    originals[key] = process.env[key];
    delete process.env[key];
  }
  return originals;
}

function restoreEnv(originals: Record<string, string | undefined>) {
  for (const [key, val] of Object.entries(originals)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
}

describe("detectSessionType", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => { saved = clearRemoteEnv(); });
  afterEach(() => { restoreEnv(saved); });

  it("returns null when no remote env vars set", () => {
    expect(detectSessionType()).toBeNull();
  });

  it("detects SSH via SSH_CONNECTION", () => {
    process.env.SSH_CONNECTION = "1.2.3.4 5678 5.6.7.8 22";
    expect(detectSessionType()).toBe("ssh");
  });

  it("detects SSH via SSH_TTY", () => {
    process.env.SSH_TTY = "/dev/pts/0";
    expect(detectSessionType()).toBe("ssh");
  });

  it("detects SSH via SSH_CLIENT", () => {
    process.env.SSH_CLIENT = "1.2.3.4 5678 22";
    expect(detectSessionType()).toBe("ssh");
  });

  it("detects devcontainer", () => {
    process.env.REMOTE_CONTAINERS = "true";
    expect(detectSessionType()).toBe("devcontainer");
  });

  it("detects codespaces", () => {
    process.env.CODESPACES = "true";
    expect(detectSessionType()).toBe("codespaces");
  });

  it("prioritizes codespaces over devcontainer", () => {
    process.env.CODESPACES = "true";
    process.env.REMOTE_CONTAINERS = "true";
    expect(detectSessionType()).toBe("codespaces");
  });

  it("prioritizes codespaces over SSH", () => {
    process.env.CODESPACES = "true";
    process.env.SSH_CONNECTION = "1.2.3.4 5678 5.6.7.8 22";
    expect(detectSessionType()).toBe("codespaces");
  });
});

describe("detectRemoteSession", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => { saved = clearRemoteEnv(); });
  afterEach(() => { restoreEnv(saved); });

  it("returns null when no remote env vars set", () => {
    expect(detectRemoteSession()).toBeNull();
  });

  it("returns SSH session with localhost relay", () => {
    process.env.SSH_CONNECTION = "1.2.3.4 5678 5.6.7.8 22";
    const session = detectRemoteSession();
    expect(session).not.toBeNull();
    expect(session!.type).toBe("ssh");
    expect(session!.relayUrl).toBe("http://127.0.0.1:19998");
  });

  it("returns devcontainer session with docker host relay", () => {
    process.env.REMOTE_CONTAINERS = "true";
    const session = detectRemoteSession();
    expect(session).not.toBeNull();
    expect(session!.type).toBe("devcontainer");
    expect(session!.relayUrl).toBe("http://host.docker.internal:19998");
  });

  it("returns codespaces session with docker host relay", () => {
    process.env.CODESPACES = "true";
    const session = detectRemoteSession();
    expect(session).not.toBeNull();
    expect(session!.type).toBe("codespaces");
    expect(session!.relayUrl).toBe("http://host.docker.internal:19998");
  });

  it("respects PEON_RELAY_HOST override for SSH", () => {
    process.env.SSH_TTY = "/dev/pts/0";
    process.env.PEON_RELAY_HOST = "10.0.0.1";
    const session = detectRemoteSession();
    expect(session!.relayUrl).toBe("http://10.0.0.1:19998");
  });

  it("respects PEON_RELAY_PORT override", () => {
    process.env.SSH_TTY = "/dev/pts/0";
    process.env.PEON_RELAY_PORT = "12345";
    const session = detectRemoteSession();
    expect(session!.relayUrl).toBe("http://127.0.0.1:12345");
  });

  it("respects PEON_RELAY_URL override", () => {
    process.env.SSH_TTY = "/dev/pts/0";
    process.env.PEON_RELAY_URL = "http://custom:9999";
    const session = detectRemoteSession();
    expect(session!.type).toBe("ssh");
    expect(session!.relayUrl).toBe("http://custom:9999");
  });

  it("PEON_RELAY_URL works even without detected session type", () => {
    process.env.PEON_RELAY_URL = "http://custom:9999";
    const session = detectRemoteSession();
    expect(session).not.toBeNull();
    expect(session!.type).toBe("ssh"); // fallback type
    expect(session!.relayUrl).toBe("http://custom:9999");
  });
});

describe("getRelayUrl", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => { saved = clearRemoteEnv(); });
  afterEach(() => { restoreEnv(saved); });

  it("returns null for 'local' mode regardless of env", () => {
    process.env.SSH_CONNECTION = "1.2.3.4 5678 5.6.7.8 22";
    expect(getRelayUrl("local")).toBeNull();
  });

  it("returns null for 'auto' mode when no remote session", () => {
    expect(getRelayUrl("auto")).toBeNull();
  });

  it("returns relay URL for 'auto' mode when SSH detected", () => {
    process.env.SSH_TTY = "/dev/pts/0";
    expect(getRelayUrl("auto")).toBe("http://127.0.0.1:19998");
  });

  it("returns relay URL for 'relay' mode even without remote session", () => {
    const url = getRelayUrl("relay");
    expect(url).toBe("http://127.0.0.1:19998");
  });

  it("returns PEON_RELAY_URL for 'relay' mode when set", () => {
    process.env.PEON_RELAY_URL = "http://myrelay:8080";
    expect(getRelayUrl("relay")).toBe("http://myrelay:8080");
  });

  it("uses PEON_RELAY_HOST and PEON_RELAY_PORT for 'relay' mode", () => {
    process.env.PEON_RELAY_HOST = "10.0.0.5";
    process.env.PEON_RELAY_PORT = "3000";
    expect(getRelayUrl("relay")).toBe("http://10.0.0.5:3000");
  });
});

describe("relaySetupInstructions", () => {
  it("provides SSH instructions", () => {
    const msg = relaySetupInstructions("ssh");
    expect(msg).toContain("peon relay --daemon");
    expect(msg).toContain("-R 19998:localhost:19998");
  });

  it("provides devcontainer instructions", () => {
    const msg = relaySetupInstructions("devcontainer");
    expect(msg).toContain("peon relay --daemon");
    expect(msg).toContain("host machine");
  });

  it("provides codespaces instructions", () => {
    const msg = relaySetupInstructions("codespaces");
    expect(msg).toContain("peon relay --daemon");
    expect(msg).toContain("host machine");
  });
});
