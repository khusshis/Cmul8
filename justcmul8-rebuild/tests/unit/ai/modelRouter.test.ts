import { describe, expect, it } from "vitest";
import { extractJSON, modelChain } from "@/lib/ai/modelRouter";

describe("extractJSON", () => {
  it("parses clean JSON", () => {
    expect(extractJSON('{"a":1,"b":[2,3]}')).toEqual({ a: 1, b: [2, 3] });
  });
  it("strips ```json code fences", () => {
    expect(extractJSON('```json\n{"x":true}\n```')).toEqual({ x: true });
    expect(extractJSON('```\n{"x":1}\n```')).toEqual({ x: 1 });
  });
  it("extracts the first balanced object after prose", () => {
    expect(extractJSON('Sure! Here it is:\n{"actionType":"NONE"} hope that helps')).toEqual({ actionType: "NONE" });
  });
  it("is string-aware: braces inside strings don't confuse it", () => {
    expect(extractJSON('{"text":"a } b { c","n":1}')).toEqual({ text: "a } b { c", n: 1 });
  });
  it("repairs a stray LaTeX backslash that breaks strict parse", () => {
    expect(extractJSON('{"text":"rho = \\ mu"}')).toEqual({ text: "rho = \\ mu" });
  });
  it("returns undefined when there is no object", () => {
    expect(extractJSON("no json here")).toBeUndefined();
    expect(extractJSON("")).toBeUndefined();
  });
});

describe("modelChain", () => {
  it("returns a de-duplicated, non-empty default chain", () => {
    const chain = modelChain();
    expect(chain.length).toBeGreaterThanOrEqual(4);
    expect(new Set(chain).size).toBe(chain.length);
    expect(chain.every((m) => typeof m === "string" && m.length > 0)).toBe(true);
  });
});
