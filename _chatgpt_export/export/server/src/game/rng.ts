import seedrandom from 'seedrandom';
import { v4 as uuidv4 } from 'uuid';

export class SeededRNG {
  private rng: seedrandom.PRNG;
  private seed: string;

  constructor(seed?: string) {
    this.seed = seed || uuidv4();
    this.rng = seedrandom(this.seed);
  }

  getSeed(): string {
    return this.seed;
  }

  // Random float between 0 and 1
  random(): number {
    return this.rng();
  }

  // Random integer between min and max (inclusive)
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  // Pick a random element from array
  pick<T>(array: T[]): T {
    return array[this.randomInt(0, array.length - 1)];
  }

  // Fisher-Yates shuffle
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
