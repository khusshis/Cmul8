import { describe, expect, it } from "vitest";
import { safeRedirect } from "@/lib/safeRedirect";

describe("safeRedirect", () => {
  it("keeps a same-origin relative path", () => {
    expect(safeRedirect("/dashboard")).toBe("/dashboard");
    expect(safeRedirect("/dashboard/project/123?tab=x#y")).toBe("/dashboard/project/123?tab=x#y");
  });
  it("falls back for null / empty / non-absolute", () => {
    expect(safeRedirect(null)).toBe("/dashboard");
    expect(safeRedirect(undefined)).toBe("/dashboard");
    expect(safeRedirect("")).toBe("/dashboard");
    expect(safeRedirect("relative/path")).toBe("/dashboard");
    expect(safeRedirect("https://evil.com")).toBe("/dashboard");
  });
  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeRedirect("//evil.com")).toBe("/dashboard");
    expect(safeRedirect("/\\evil.com")).toBe("/dashboard");
    expect(safeRedirect("/\\/evil.com")).toBe("/dashboard");
  });
  it("honours a custom fallback", () => {
    expect(safeRedirect("//evil.com", "/login")).toBe("/login");
  });
});
