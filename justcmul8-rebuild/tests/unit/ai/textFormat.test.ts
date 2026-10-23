import { describe, expect, it } from "vitest";
import { toPlainMarkdown } from "@/lib/ai/textFormat";

describe("toPlainMarkdown", () => {
  it("unwraps inline math and spells out Greek", () => {
    expect(toPlainMarkdown("$\\rho = 0.75$")).toBe("rho = 0.75");
    expect(toPlainMarkdown("utilisation $ρ$ is high")).toBe("utilisation rho is high");
    expect(toPlainMarkdown("$\\lambda = 2$ and $\\mu = 3$")).toBe("lambda = 2 and mu = 3");
  });
  it("keeps currency amounts intact", () => {
    expect(toPlainMarkdown("costs $5 per item")).toBe("costs $5 per item");
    expect(toPlainMarkdown("save $1,200 a month")).toBe("save $1,200 a month");
  });
  it("converts fractions, arrows and operators", () => {
    expect(toPlainMarkdown("$\\frac{a}{b}$")).toBe("(a)/(b)");
    expect(toPlainMarkdown("A \\rightarrow B")).toBe("A -> B");
    expect(toPlainMarkdown("x \\geq 5")).toBe("x >= 5");
  });
  it("strips a leftover lone backslash", () => {
    expect(toPlainMarkdown("mu \\ = 0.667")).not.toContain("\\");
  });
  it("is idempotent", () => {
    const once = toPlainMarkdown("$\\rho = \\lambda / \\mu$");
    expect(toPlainMarkdown(once)).toBe(once);
  });
  it("handles empty / plain strings", () => {
    expect(toPlainMarkdown("")).toBe("");
    expect(toPlainMarkdown("Just a normal sentence.")).toBe("Just a normal sentence.");
  });
});
