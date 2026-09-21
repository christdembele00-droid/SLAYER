export class MatchClock {
  private elapsed = 0;
  private running = false;

  start(): void { this.running = true; }
  stop(): void { this.running = false; }
  reset(): void { this.elapsed = 0; this.running = false; }

  update(deltaSeconds: number): void {
    if (this.running) this.elapsed += Math.max(0, deltaSeconds);
  }

  get seconds(): number { return this.elapsed; }

  format(): string {
    const total = Math.floor(this.elapsed);
    const minutes = Math.floor(total / 60).toString().padStart(2, "0");
    const seconds = (total % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }
}