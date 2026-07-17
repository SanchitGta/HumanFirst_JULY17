import { describe, expect, it } from "vitest";
import { isValidHandle, slugifyHandle, RESERVED_HANDLES } from "@/lib/handles";

describe("handles", () => {
  it("accepts a well-formed handle", () => {
    expect(isValidHandle("sanchit")).toBe(true);
    expect(isValidHandle("sanchit-k")).toBe(true);
    expect(isValidHandle("abc")).toBe(true);
  });

  it("rejects handles shorter than 3 or longer than 30 chars", () => {
    expect(isValidHandle("ab")).toBe(false);
    expect(isValidHandle("a".repeat(31))).toBe(false);
  });

  it("rejects handles with invalid characters", () => {
    expect(isValidHandle("Sanchit")).toBe(false); // uppercase
    expect(isValidHandle("san_chit")).toBe(false); // underscore
    expect(isValidHandle("san chit")).toBe(false); // space
  });

  it("rejects every reserved handle", () => {
    for (const reserved of RESERVED_HANDLES) {
      expect(isValidHandle(reserved)).toBe(false);
    }
  });

  it("slugifies an email into a lowercase, hyphenated default", () => {
    expect(slugifyHandle("Sanchit.Kumar@example.com")).toBe("sanchit-kumar");
  });

  it("slugify output is itself a valid-shape handle when long enough", () => {
    const slug = slugifyHandle("Jane Doe");
    expect(slug).toBe("jane-doe");
    expect(isValidHandle(slug)).toBe(true);
  });
});
