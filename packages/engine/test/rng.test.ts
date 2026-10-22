import { describe, expect, it } from "vitest";
import { Rng, uniform } from "@ps/engine";

describe("rng", () => {
  it("uniform is deterministic and in [0, 1)", () => {
    for (let c = 0; c < 200; c++) {
      const a = uniform("seed-1", c);
      expect(a).toBe(uniform("seed-1", c));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  it("different seeds or cursors give different values", () => {
    expect(uniform("seed-1", 0)).not.toBe(uniform("seed-2", 0));
    expect(uniform("seed-1", 0)).not.toBe(uniform("seed-1", 1));
  });

  it("Rng walks the counter and matches uniform", () => {
    const r = new Rng("abc", 5);
    expect(r.next()).toBe(uniform("abc", 5));
    expect(r.next()).toBe(uniform("abc", 6));
    expect(r.cursor).toBe(7);
  });

  it("two Rngs with the same seed and cursor agree", () => {
    const a = new Rng("x", 0);
    const b = new Rng("x", 0);
    for (let i = 0; i < 50; i++) expect(a.int(1, 100)).toBe(b.int(1, 100));
  });

  it("int(1, 100) is inclusive and roughly uniform over 100k draws (loose chi-square)", () => {
    const r = new Rng("chi-square", 0);
    const n = 100_000;
    const counts = new Array<number>(100).fill(0);
    for (let i = 0; i < n; i++) {
      const v = r.int(1, 100);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
      counts[v - 1]! += 1;
    }
    expect(Math.min(...counts)).toBeGreaterThan(0);
    const expected = n / 100;
    const chi = counts.reduce((acc, c) => acc + (c - expected) ** 2 / expected, 0);
    // df = 99: mean 99, sd about 14. 180 is far beyond a plausible fluctuation.
    expect(chi).toBeLessThan(180);
  });

  it("int(min, max) with min == max returns min", () => {
    const r = new Rng("s", 0);
    expect(r.int(7, 7)).toBe(7);
  });
});
