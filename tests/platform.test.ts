import { describe, it, expect } from "bun:test";
import { detectPlatform, type Platform } from "../src/platform";
import { platform as osPlatform } from "node:os";

describe("detectPlatform", () => {
  it("returns a valid platform string", () => {
    const result = detectPlatform();
    const valid: Platform[] = ["mac", "linux", "wsl", "unknown"];
    expect(valid).toContain(result);
  });

  it("matches the current os.platform()", () => {
    const result = detectPlatform();
    const p = osPlatform();

    if (p === "darwin") {
      expect(result).toBe("mac");
    } else if (p === "linux") {
      // Could be "linux" or "wsl"
      expect(["linux", "wsl"]).toContain(result);
    } else {
      expect(result).toBe("unknown");
    }
  });
});
