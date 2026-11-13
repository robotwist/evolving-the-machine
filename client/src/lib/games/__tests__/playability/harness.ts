/**
 * Headless playtest harness. Drives a real game class frame by frame with a bot,
 * using a seeded RNG so tuning passes are reproducible.
 *
 * Playtests are opt-in (slow): PLAYABILITY=1 npx jest playability
 */
import type { BaseGame } from '../../BaseGame';
import { SIMULATION_STEP_MS } from '../../BaseGame';
import { createMockCanvasContext } from '../../../utils/__tests__/testUtils';

export const FPS = 60;
export const STEP_MS = SIMULATION_STEP_MS;

export const describePlayability = process.env.PLAYABILITY ? describe : describe.skip;

/** Mulberry32: small, fast, seedable PRNG. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Replaces Math.random for the duration of `fn`. */
export async function withSeed<T>(seed: number, fn: () => Promise<T>): Promise<T> {
  const original = Math.random;
  Math.random = seededRandom(seed);
  try {
    return await fn();
  } finally {
    Math.random = original;
  }
}

type GameClass<T extends BaseGame> = new (ctx: CanvasRenderingContext2D, width: number, height: number) => T;

export interface RunOptions<T extends BaseGame> {
  /** Hard cap on simulated time; hitting it counts as a timeout (stuck or endless). */
  maxSeconds: number;
  width?: number;
  height?: number;
  /** Called before every update; set keys, call pointer handlers, etc. */
  bot: (game: T, frame: number, rng: () => number) => void;
  /** Optional per-frame probe, e.g. to record when the player first takes damage. */
  observe?: (game: T, frame: number) => void;
}

export interface RunResult {
  outcome: 'won' | 'lost' | 'timeout' | 'error';
  seconds: number;
  finalScore: number;
  gameOverCalls: number;
  stageCompleteCalls: number;
  error?: string;
  /** Free-form metrics recorded by `observe` via result.metrics. */
  metrics: Record<string, number>;
}

/**
 * Plays one session. The game ends on the first onGameOver/onStageComplete; the run
 * continues for one extra second afterwards to catch callbacks that fire repeatedly.
 */
export async function playSession<T extends BaseGame>(
  GameCtor: GameClass<T>,
  seed: number,
  options: RunOptions<T>,
  metrics: Record<string, number> = {}
): Promise<RunResult> {
  return withSeed(seed, async () => {
    const botRng = seededRandom(seed ^ 0x9e3779b9);
    const game = new GameCtor(createMockCanvasContext() as CanvasRenderingContext2D, options.width ?? 1000, options.height ?? 700);
    let gameOverCalls = 0;
    let stageCompleteCalls = 0;
    let finalScore = 0;
    game.onGameOver = () => { gameOverCalls++; };
    game.onStageComplete = () => { stageCompleteCalls++; };
    game.onScoreUpdate = (score: number) => { finalScore = score; };

    const maxFrames = Math.round(options.maxSeconds * FPS);
    let frame = 0;
    let endedAt: number | null = null;
    try {
      await game.init();
      (game as unknown as { isRunning: boolean }).isRunning = true;
      while (frame < maxFrames) {
        options.bot(game, frame, botRng);
        game.update(STEP_MS);
        options.observe?.(game, frame);
        frame++;
        if (endedAt === null && (gameOverCalls > 0 || stageCompleteCalls > 0)) endedAt = frame;
        if (endedAt !== null && frame - endedAt >= FPS) break;
      }
    } catch (e) {
      return {
        outcome: 'error', seconds: frame / FPS, finalScore, gameOverCalls, stageCompleteCalls,
        error: e instanceof Error ? `${e.message}\n${e.stack?.split('\n').slice(0, 4).join('\n')}` : String(e),
        metrics,
      };
    } finally {
      game.destroy();
    }

    const outcome = stageCompleteCalls > 0 ? 'won' : gameOverCalls > 0 ? 'lost' : 'timeout';
    return { outcome, seconds: (endedAt ?? frame) / FPS, finalScore, gameOverCalls, stageCompleteCalls, metrics };
  });
}

export interface Summary {
  runs: number;
  winRate: number;
  lossRate: number;
  timeoutRate: number;
  errors: string[];
  medianSeconds: number;
  /** Runs where onGameOver or onStageComplete fired more than once, or both fired. */
  duplicateEndCallbacks: number;
  metricMedians: Record<string, number>;
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function summarize(results: RunResult[]): Summary {
  const metricKeys = Array.from(new Set(results.flatMap(r => Object.keys(r.metrics))));
  const metricMedians: Record<string, number> = {};
  for (const key of metricKeys) {
    metricMedians[key] = median(results.map(r => r.metrics[key]).filter(v => Number.isFinite(v)));
  }
  return {
    runs: results.length,
    winRate: results.filter(r => r.outcome === 'won').length / results.length,
    lossRate: results.filter(r => r.outcome === 'lost').length / results.length,
    timeoutRate: results.filter(r => r.outcome === 'timeout').length / results.length,
    errors: results.filter(r => r.error).map(r => r.error as string),
    medianSeconds: median(results.filter(r => r.outcome !== 'timeout').map(r => r.seconds)),
    duplicateEndCallbacks: results.filter(r => r.gameOverCalls > 1 || r.stageCompleteCalls > 1 || (r.gameOverCalls > 0 && r.stageCompleteCalls > 0)).length,
    metricMedians,
  };
}

/** Runs `count` seeded sessions and returns the summary plus raw results. */
export async function playMany<T extends BaseGame>(
  GameCtor: GameClass<T>,
  count: number,
  options: RunOptions<T>,
  makeMetrics: () => Record<string, number> = () => ({})
): Promise<{ summary: Summary; results: RunResult[] }> {
  const results: RunResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(await playSession(GameCtor, 1000 + i, options, makeMetrics()));
  }
  return { summary: summarize(results), results };
}

export function report(label: string, summary: Summary) {
  console.info(`[playability] ${label}\n${JSON.stringify(summary, null, 2)}`);
}

/**
 * Human-like reaction: returns true once `delayFrames` have passed since `since`.
 * Bots should only react to things a player could see, after a human delay.
 */
export function reacted(frame: number, since: number | null, delayFrames = 12): boolean {
  return since !== null && frame - since >= delayFrames;
}

/** Sets exactly these keys as held for the coming update. */
export function holdKeys(game: BaseGame, codes: string[]) {
  const keys = (game as unknown as { keys: Set<string> }).keys;
  keys.clear();
  for (const code of codes) keys.add(code);
}
