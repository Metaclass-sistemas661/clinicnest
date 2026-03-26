import { describe, it, expect, vi } from "vitest";
import { maskSensitive } from "@/lib/logger";

describe("maskSensitive", () => {
  it("masks normal strings", () => {
    const result = maskSensitive("user@email.com");
    expect(result).toBe("us****om");
    expect(result).not.toContain("@");
  });

  it("masks short strings completely", () => {
    expect(maskSensitive("abc")).toBe("****");
    expect(maskSensitive("ab")).toBe("****");
  });

  it("handles null/undefined", () => {
    expect(maskSensitive(null)).toBe("—");
    expect(maskSensitive(undefined)).toBe("—");
  });

  it("masks numbers", () => {
    const result = maskSensitive(123456);
    expect(result).toBe("12****56");
  });

  it("masks UUIDs", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = maskSensitive(uuid);
    expect(result).toBe("55****00");
    expect(result).not.toContain("550e8400");
  });
});
