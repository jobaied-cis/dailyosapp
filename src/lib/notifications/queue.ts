/**
 * Tiny min-heap used by the notification scheduler.
 * Kept generic and self-contained so the scheduler stays testable.
 */

export class MinHeap<T> {
  private data: T[] = [];
  constructor(private cmp: (a: T, b: T) => number) {}

  size(): number {
    return this.data.length;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  push(v: T): void {
    this.data.push(v);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  clear(): void {
    this.data = [];
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cmp(this.data[i], this.data[p]) < 0) {
        [this.data[i], this.data[p]] = [this.data[p], this.data[i]];
        i = p;
      } else break;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let m = i;
      if (l < n && this.cmp(this.data[l], this.data[m]) < 0) m = l;
      if (r < n && this.cmp(this.data[r], this.data[m]) < 0) m = r;
      if (m === i) break;
      [this.data[i], this.data[m]] = [this.data[m], this.data[i]];
      i = m;
    }
  }
}
