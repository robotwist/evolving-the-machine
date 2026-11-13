import { DanceInterlude } from '../../DanceInterlude';
import { FPS, describePlayability, playMany, report, type RunResult, type Summary } from './harness';

type TargetView = { x: number; y: number; time: number; duration: number; hit: boolean; active: boolean };
type DanceView = {
  rhythmTargets: TargetView[];
  combo: number;
  score: number;
  danceTimer: number;
};
type Bot = (game: DanceInterlude, frame: number, rng: () => number) => void;

const view = (game: DanceInterlude) => game as unknown as DanceView;

const DANCE_SECONDS = 180;
const MAX_SECONDS = DANCE_SECONDS + 6;
const SESSIONS = 30;
const TIMEOUT_MS = 600_000;

const REACTION_FRAMES = 12;
const REACTION_JITTER_FRAMES = 6;
const AIM_ERROR_PX = 25;
const SKIP_CHANCE = 0.12;
/** Conservative minimum hit diameter used for the reachability estimate. */
const MIN_TARGET_DIAMETER_PX = 40;
const SKIP_PRESS_FRAME = 4 * FPS;
/** Perfect-run ceiling accepted by the score store's anti-cheat check for stage 6. */
const ANTI_CHEAT_MAX_SCORE = 20000;
const MAX_TARGETS_ON_SCREEN = 3;

/** Fitts' law pointer travel time (touch/mouse), in frames. */
function movementFrames(distance: number, width = MIN_TARGET_DIAMETER_PX): number {
  const seconds = 0.1 + 0.12 * Math.log2(distance / width + 1);
  return Math.ceil(seconds * FPS);
}

interface Plan { seenAt: number; reaction: number; dx: number; dy: number; skip: boolean }

/**
 * Human-like player: notices each target the frame after it appears, reacts after
 * ~0.2-0.3 s, then moves the pointer there (Fitts' law travel time from the last tap)
 * and taps with up to 25 px of aiming error. Skips ~12% of targets entirely, and only
 * taps one target at a time, oldest first.
 */
function humanLikeBot(): Bot {
  const plans = new Map<TargetView, Plan>();
  let lastTap = { x: 500, y: 350, frame: -Infinity };
  return (game, frame, rng) => {
    const g = view(game);
    for (const t of g.rhythmTargets) {
      if (!t.active || plans.has(t)) continue;
      const r = AIM_ERROR_PX * Math.sqrt(rng());
      const a = rng() * Math.PI * 2;
      plans.set(t, {
        seenAt: frame,
        reaction: REACTION_FRAMES + Math.floor(rng() * REACTION_JITTER_FRAMES),
        dx: Math.cos(a) * r,
        dy: Math.sin(a) * r,
        skip: rng() < SKIP_CHANCE,
      });
    }
    const candidates = g.rhythmTargets
      .filter(t => t.active && !plans.get(t)!.skip)
      .sort((a, b) => a.time - b.time);
    for (const t of candidates) {
      const plan = plans.get(t)!;
      const start = Math.max(plan.seenAt + plan.reaction, lastTap.frame);
      const tapAt = start + movementFrames(Math.hypot(t.x - lastTap.x, t.y - lastTap.y));
      if (frame < tapAt) return;
      const x = t.x + plan.dx;
      const y = t.y + plan.dy;
      game.handlePointerDown(x, y);
      plans.get(t)!.skip = true;
      lastTap = { x, y, frame };
      return;
    }
  };
}

/** Taps the dead center of every target after a fixed reaction delay. */
function perfectBot(): Bot {
  return (game) => {
    const g = view(game);
    for (const t of g.rhythmTargets) {
      if (t.active && g.danceTimer - t.time >= REACTION_FRAMES) game.handlePointerDown(t.x, t.y);
    }
  };
}

function idleBot(): Bot {
  return () => {};
}

function skipBot(): Bot {
  return (game, frame) => {
    // A double-tap of Space must still complete exactly once
    if (frame === SKIP_PRESS_FRAME || frame === SKIP_PRESS_FRAME + 5) {
      game.handleInput(new KeyboardEvent('keydown', { code: 'Space' }));
    }
  };
}

function makeMetrics(): Record<string, number> {
  return {
    targetsSpawned: 0,
    hits: 0,
    hitRate: NaN,
    maxCombo: 0,
    score: 0,
    scoreDecreases: 0,
    reachableFraction: NaN,
    meanGapSec: NaN,
    minGapSec: NaN,
    maxSimultaneousTargets: 0,
    lastTargetSec: NaN,
  };
}

/**
 * Tracks spawned targets, hits, combo and score, plus whether an ideal human (12-frame
 * reaction, Fitts' law travel from the previous target, no aiming error) could reach
 * each target before it expires.
 */
function observer(metrics: Record<string, number>) {
  const seen = new Set<TargetView>();
  const hit = new Set<TargetView>();
  const spawnFrames: number[] = [];
  let reachable = 0;
  let lastScore = 0;
  let reach = { x: 500, y: 350, frame: -Infinity };
  return (game: DanceInterlude, frame: number) => {
    const g = view(game);
    let active = 0;
    for (const t of g.rhythmTargets) {
      if (t.active) active++;
      if (!seen.has(t)) {
        seen.add(t);
        spawnFrames.push(frame);
        metrics.targetsSpawned++;
        metrics.lastTargetSec = frame / FPS;
        const tapAt = Math.max(frame + 1 + REACTION_FRAMES, reach.frame)
          + movementFrames(Math.hypot(t.x - reach.x, t.y - reach.y));
        if (tapAt < t.time + t.duration) {
          reachable++;
          reach = { x: t.x, y: t.y, frame: tapAt };
        }
      }
      if (t.hit && !hit.has(t)) {
        hit.add(t);
        metrics.hits++;
      }
    }
    metrics.maxSimultaneousTargets = Math.max(metrics.maxSimultaneousTargets, active);
    metrics.maxCombo = Math.max(metrics.maxCombo, g.combo);
    if (g.score < lastScore) metrics.scoreDecreases++;
    lastScore = g.score;
    metrics.score = g.score;
    if (metrics.targetsSpawned > 0) {
      metrics.hitRate = metrics.hits / metrics.targetsSpawned;
      metrics.reachableFraction = reachable / metrics.targetsSpawned;
    }
    if (spawnFrames.length > 1) {
      const gaps = spawnFrames.slice(1).map((f, i) => (f - spawnFrames[i]) / FPS);
      metrics.meanGapSec = gaps.reduce((s, v) => s + v, 0) / gaps.length;
      metrics.minGapSec = Math.min(...gaps);
    }
  };
}

/** Wraps playMany so each session gets a fresh bot and observer bound to its own metrics. */
async function play(bot: () => Bot, count = SESSIONS) {
  let currentBot = bot();
  let currentObserve: (game: DanceInterlude, frame: number) => void = () => {};
  const metricsFactory = () => {
    const m = makeMetrics();
    currentBot = bot();
    currentObserve = observer(m);
    return m;
  };
  return playMany(DanceInterlude, count, {
    maxSeconds: MAX_SECONDS,
    bot: (game, frame, rng) => currentBot(game, frame, rng),
    observe: (game, frame) => currentObserve(game, frame),
  }, metricsFactory);
}

function outcomes(results: RunResult[]) {
  return results.map(r => `${r.outcome[0]}${r.seconds.toFixed(1)}`).join(' ');
}

function expectCleanCompletion(results: RunResult[], summary: Summary) {
  expect(summary.errors).toEqual([]);
  expect(summary.duplicateEndCallbacks).toBe(0);
  expect(results.every(r => r.gameOverCalls === 0)).toBe(true);
  expect(results.every(r => r.stageCompleteCalls === 1)).toBe(true);
  expect(summary.winRate).toBe(1);
  expect(summary.timeoutRate).toBe(0);
  expect(Math.max(...results.map(r => r.metrics.scoreDecreases))).toBe(0);
  expect(Math.max(...results.map(r => r.metrics.maxSimultaneousTargets))).toBeLessThanOrEqual(MAX_TARGETS_ON_SCREEN);
}

describePlayability('Dance Interlude playability', () => {
  test('human-like player: fair targets, sensible scoring, completes once', async () => {
    const { summary, results } = await play(humanLikeBot);
    report('DanceInterlude / human-like', summary);
    console.info(`[playability] DanceInterlude / human-like outcomes ${outcomes(results)}`);

    expectCleanCompletion(results, summary);
    expect(summary.medianSeconds).toBeGreaterThanOrEqual(175);
    expect(summary.medianSeconds).toBeLessThanOrEqual(190);

    const m = summary.metricMedians;
    expect(m.hitRate).toBeGreaterThanOrEqual(0.65);
    expect(m.hitRate).toBeLessThanOrEqual(0.95);
    expect(m.reachableFraction).toBeGreaterThanOrEqual(0.98);
    expect(m.targetsSpawned).toBeGreaterThanOrEqual(60);
    expect(m.lastTargetSec).toBeGreaterThanOrEqual(DANCE_SECONDS - 20);
    expect(m.minGapSec).toBeGreaterThanOrEqual(0.5);
    expect(m.maxCombo).toBeGreaterThanOrEqual(8);
    expect(m.score).toBeGreaterThan(0);
    expect(Math.min(...results.map(r => r.finalScore))).toBeGreaterThan(0);
    expect(results.every(r => r.finalScore === r.metrics.score)).toBe(true);
    expect(Math.max(...results.map(r => r.finalScore))).toBeLessThanOrEqual(ANTI_CHEAT_MAX_SCORE);
  }, TIMEOUT_MS);

  test('perfect player: every target is hittable and the score stays under the anti-cheat cap', async () => {
    const { summary, results } = await play(perfectBot, 5);
    report('DanceInterlude / perfect', summary);

    expectCleanCompletion(results, summary);
    expect(results.every(r => r.metrics.hitRate === 1)).toBe(true);
    expect(results.every(r => r.metrics.maxCombo === r.metrics.targetsSpawned)).toBe(true);
    expect(Math.max(...results.map(r => r.finalScore))).toBeLessThanOrEqual(ANTI_CHEAT_MAX_SCORE);
  }, TIMEOUT_MS);

  test('skip player: Space completes promptly and exactly once', async () => {
    const { summary, results } = await play(skipBot);
    report('DanceInterlude / skip', summary);
    console.info(`[playability] DanceInterlude / skip outcomes ${outcomes(results)}`);

    expectCleanCompletion(results, summary);
    const pressedAt = SKIP_PRESS_FRAME / FPS;
    expect(Math.max(...results.map(r => r.seconds))).toBeLessThanOrEqual(pressedAt + 5);
    expect(Math.min(...results.map(r => r.seconds))).toBeGreaterThanOrEqual(pressedAt);
  }, TIMEOUT_MS);

  test('idle player: the dance still completes once at ~180 s', async () => {
    const { summary, results } = await play(idleBot);
    report('DanceInterlude / idle', summary);
    console.info(`[playability] DanceInterlude / idle outcomes ${outcomes(results)}`);

    expectCleanCompletion(results, summary);
    expect(Math.min(...results.map(r => r.seconds))).toBeGreaterThanOrEqual(175);
    expect(Math.max(...results.map(r => r.seconds))).toBeLessThanOrEqual(190);
  }, TIMEOUT_MS);
});
