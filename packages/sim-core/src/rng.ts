// splitmix64 —— 跨平台一致（只用 BigInt 整数运算）。逐字搬自 sim/world.mjs，不许改。
export class Rng {
  s: bigint;

  constructor(seed: number | bigint = 0x12345678) {
    this.s = BigInt(seed) & 0xffffffffffffffffn;
  }

  next(): number {
    this.s = (this.s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    z = z ^ (z >> 31n);
    return Number(z & 0x7fffffffn) / 2147483647; // [0,1)
  }

  int(n: number): number { return Math.floor(this.next() * n) % n; }

  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }

  weighted<T>(items: readonly T[], keyFn: (it: T) => number): T | null {
    const total = items.reduce((a, b) => a + keyFn(b), 0);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (const it of items) { r -= keyFn(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }
}
