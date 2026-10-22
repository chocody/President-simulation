// Counter-based RNG: the value depends only on (seed, cursor), so any state can be replayed.
// Pure: no Math.random, no Date.

/** xmur3-style string hash: folds the whole seed into one 32-bit number. */
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** splitmix32 step at position `cursor` of the stream that starts at `h`. */
function mix(h: number, cursor: number): number {
  let a = (h + Math.imul(cursor + 1, 0x9e3779b9)) | 0;
  let t = a ^ (a >>> 16);
  t = Math.imul(t, 0x21f0aaad);
  t ^= t >>> 15;
  t = Math.imul(t, 0x735a2d97);
  t ^= t >>> 15;
  return (t >>> 0) / 4294967296;
}

/** Same seed + cursor -> same value in [0, 1), always. */
export function uniform(seed: string, cursor: number): number {
  return mix(hashSeed(seed), cursor);
}

export class Rng {
  private readonly h: number;
  private c: number;

  constructor(seed: string, cursor: number) {
    this.h = hashSeed(seed);
    this.c = cursor;
  }

  /** Next value in [0, 1). */
  next(): number {
    return mix(this.h, this.c++);
  }

  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  get cursor(): number {
    return this.c;
  }
}
