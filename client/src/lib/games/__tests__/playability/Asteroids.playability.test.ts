import { AsteroidsGame } from '../../AsteroidsGame';
import { FPS, describePlayability, holdKeys, playMany, report, type RunResult } from './harness';

type Vec = { x: number; y: number };
type Body = { position: Vec; velocity: Vec; size: number };

/** Only what a player can see on screen (or in the HUD). */
type AsteroidsView = {
  player: Body & { rotation: number };
  asteroids: Body[];
  lives: number;
  level: number;
  score: number;
  width: number;
  height: number;
};

const view = (game: AsteroidsGame) => game as unknown as AsteroidsView;

/** On-screen offset from `from` to (x, y): the field wraps, and rocks straddling an edge are drawn on both sides. */
function offset(v: AsteroidsView, from: Vec, x: number, y: number) {
  const wrap = (d: number, span: number) => d - span * Math.round(d / span);
  return { dx: wrap(x - from.x, v.width), dy: wrap(y - from.y, v.height) };
}

const REACTION_FRAMES = 12;
const MIN_TAP_INTERVAL_FRAMES = 12;
const BULLET_SPEED_GUESS = 4.8;
const THREAT_NOTICE_CHANCE = 0.7;

interface Seen { ref: Body; x: number; y: number; vx: number; vy: number; size: number }

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Human-like pilot. It sees the field as it was ~0.2 s ago (new fragments and rocks
 * register late), extrapolates the drift it saw, aims with a per-decision angular error,
 * taps fire no faster than ~5 Hz, dodges rocks it judges to be on a collision course,
 * and has occasional half-second lapses of attention.
 */
function humanLikeBot() {
  const history: Seen[][] = [];
  let aimError = 0;
  let targetRef: Body | null = null;
  let lastTap = -1000;
  let lapseUntil = -1;
  let nextDecision = 0;
  let dodging = false;
  let dodgeAngle = 0;

  return (game: AsteroidsGame, frame: number, rng: () => number) => {
    const v = view(game);
    history.push(v.asteroids.map(a => ({ ref: a, x: a.position.x, y: a.position.y, vx: a.velocity.x, vy: a.velocity.y, size: a.size })));
    if (history.length > REACTION_FRAMES + 1) history.shift();
    const delayed = history[0];
    const lag = history.length - 1;
    // Extrapolate what was seen `lag` frames ago, as a player tracking drift would.
    const seen = delayed.map(s => ({ ...s, x: s.x + s.vx * lag, y: s.y + s.vy * lag }));

    if (frame < lapseUntil) { holdKeys(game, []); return; }
    if (rng() < 0.002) { lapseUntil = frame + 30; holdKeys(game, []); return; }

    const ship = v.player;
    const keys: string[] = [];

    if (frame >= nextDecision) {
      nextDecision = frame + REACTION_FRAMES;
      aimError = (rng() * 2 - 1) * 0.12;

      // Threat check: closest approach within the next second
      dodging = false;
      let worst = Infinity;
      for (const s of seen) {
        // Players don't track every rock at once; some threats go unnoticed this glance.
        if (rng() > THREAT_NOTICE_CHANCE) continue;
        const { dx: rx, dy: ry } = offset(v, ship.position, s.x, s.y);
        const rvx = s.vx - ship.velocity.x, rvy = s.vy - ship.velocity.y;
        const rv2 = rvx * rvx + rvy * rvy;
        const t = rv2 > 0 ? Math.max(0, Math.min(60, -(rx * rvx + ry * rvy) / rv2)) : 0;
        const cx = rx + rvx * t, cy = ry + rvy * t;
        const miss = Math.hypot(cx, cy) - s.size;
        if (miss < 18 && t < worst) {
          worst = t;
          dodging = Math.hypot(rx, ry) < 160;
          // Move perpendicular to the rock's approach, away from its line
          const away = Math.atan2(-cy, -cx);
          dodgeAngle = Number.isFinite(away) ? away : Math.atan2(-ry, -rx);
        }
      }

      // Pick the nearest visible rock as the target
      let best: Seen | null = null;
      let bestD = Infinity;
      for (const s of seen) {
        const { dx, dy } = offset(v, ship.position, s.x, s.y);
        const d = Math.hypot(dx, dy) - s.size * 0.5;
        if (d < bestD) { bestD = d; best = s; }
      }
      targetRef = best?.ref ?? null;
    }

    const target = seen.find(s => s.ref === targetRef) ?? null;
    const speed = Math.hypot(ship.velocity.x, ship.velocity.y);

    if (dodging) {
      const diff = wrapAngle(dodgeAngle - ship.rotation);
      if (diff > 0.15) keys.push('KeyD');
      else if (diff < -0.15) keys.push('KeyA');
      if (Math.abs(diff) < 0.8 && speed < 3) keys.push('KeyW');
    } else if (target) {
      const { dx, dy } = offset(v, ship.position, target.x, target.y);
      const dist = Math.hypot(dx, dy);
      const t = dist / BULLET_SPEED_GUESS;
      const aim = Math.atan2(dy + target.vy * t, dx + target.vx * t) + aimError;
      const diff = wrapAngle(aim - ship.rotation);
      if (diff > 0.06) keys.push('KeyD');
      else if (diff < -0.06) keys.push('KeyA');
      // Close in on distant rocks, but let ones drifting away wrap back around instead of chasing them
      const recession = (dx * target.vx + dy * target.vy) / Math.max(1, dist);
      if (Math.abs(diff) < 0.3 && dist > 230 && speed < 1.2 && recession < 0.5) keys.push('KeyW');
      if (Math.abs(diff) < 0.15 && dist < 300 && frame - lastTap >= MIN_TAP_INTERVAL_FRAMES) {
        keys.push('Space');
        lastTap = frame;
      }
    }
    holdKeys(game, keys);
  };
}

const idleBot = (game: AsteroidsGame) => holdKeys(game, []);

function makeMetrics(): Record<string, number> {
  return {
    firstLifeLostSec: Infinity,
    lifeLostBefore5s: 0,
    deathsFirst20s: 0,
    gameLostBefore20s: 0,
    longestScoreGapSec: 0,
    minSpawnClearance: Infinity,
    levelReached: 1,
    livesLost: 0,
    /** Lives lost within QUICK_REDEATH_SEC of the previous one, i.e. soon after respawn protection ends. */
    quickRedeaths: 0,
  };
}

const QUICK_REDEATH_SEC = 4.5;

/** Probe that records fairness / pacing metrics from on-screen state only. */
function observer() {
  let state: { lives: number; level: number; score: number; scoreAt: number; lifeLostAt: number } | null = null;
  return (metrics: Record<string, number>) => (game: AsteroidsGame, frame: number) => {
    const v = view(game);
    const sec = (frame + 1) / FPS;
    const clearance = () => Math.min(...v.asteroids.map(a => {
      const { dx, dy } = offset(v, v.player.position, a.position.x, a.position.y);
      return Math.hypot(dx, dy) - a.size;
    }));
    if (frame === 0 || state === null) {
      state = { lives: v.lives, level: v.level, score: v.score, scoreAt: 0, lifeLostAt: -Infinity };
      metrics.minSpawnClearance = Math.min(metrics.minSpawnClearance, clearance());
      return;
    }
    if (v.lives < state.lives) {
      const lost = state.lives - v.lives;
      metrics.livesLost += lost;
      if (sec - state.lifeLostAt <= QUICK_REDEATH_SEC) metrics.quickRedeaths++;
      state.lifeLostAt = sec;
      if (!Number.isFinite(metrics.firstLifeLostSec)) metrics.firstLifeLostSec = sec;
      if (sec <= 5) metrics.lifeLostBefore5s = 1;
      if (sec <= 20) metrics.deathsFirst20s += lost;
      if (v.lives <= 0 && sec <= 20) metrics.gameLostBefore20s = 1;
    }
    if (v.level > state.level && v.asteroids.length > 0) {
      metrics.levelReached = v.level;
      metrics.minSpawnClearance = Math.min(metrics.minSpawnClearance, clearance());
    }
    if (v.score !== state.score) {
      metrics.longestScoreGapSec = Math.max(metrics.longestScoreGapSec, sec - state.scoreAt);
      state.scoreAt = sec;
    }
    state.lives = v.lives;
    state.level = v.level;
    state.score = v.score;
  };
}

type Bot = (game: AsteroidsGame, frame: number, rng: () => number) => void;

/** playMany calls makeMetrics right before each session, so a fresh bot and probe are built there. */
async function run(makeBot: () => Bot, count: number, maxSeconds: number) {
  let bot: Bot = makeBot();
  let observe: ((game: AsteroidsGame, frame: number) => void) | null = null;
  return playMany(AsteroidsGame, count, {
    maxSeconds,
    bot: (game, frame, rng) => bot(game, frame, rng),
    observe: (game, frame) => observe?.(game, frame),
  }, () => {
    const metrics = makeMetrics();
    bot = makeBot();
    observe = observer()(metrics);
    return metrics;
  });
}

function rate(results: RunResult[], pred: (r: RunResult) => boolean) {
  return results.filter(pred).length / results.length;
}

describePlayability('Asteroids playability', () => {
  test('human-like pilot: fair, winnable, and finishes in a few minutes', async () => {
    // ASTEROIDS_RUNS=200 gives a tighter estimate when retuning
    const { summary, results } = await run(humanLikeBot, Number(process.env.ASTEROIDS_RUNS ?? 60), 900);
    report('Asteroids / human-like', summary);
    const isEarlyLoss = (r: RunResult) => r.metrics.lifeLostBefore5s > 0 || r.metrics.gameLostBefore20s > 0;
    const earlyLoss = rate(results, isEarlyLoss);
    const early = results.map((r, i) => isEarlyLoss(r) ? `seed ${1000 + i}: first life lost at ${r.metrics.firstLifeLostSec.toFixed(1)}s` : '').filter(Boolean);
    const worstSpawnClearance = Math.min(...results.map(r => r.metrics.minSpawnClearance));
    const worstScoreGap = Math.max(...results.map(r => r.metrics.longestScoreGapSec));
    const longScoreGapRate = rate(results, r => r.metrics.longestScoreGapSec > 30);
    const quickRedeathRate = rate(results, r => r.metrics.quickRedeaths > 0);
    const outcomes = results.map(r => `${r.outcome[0]}${Math.round(r.seconds)}:W${r.metrics.levelReached}`).join(' ');
    console.info(`[playability] Asteroids early-loss rate ${earlyLoss} [${early.join('; ')}]; `
      + `worst spawn clearance ${worstSpawnClearance.toFixed(0)}px; worst score gap ${worstScoreGap.toFixed(1)}s `
      + `(runs with a gap > 30 s: ${longScoreGapRate}); `
      + `runs with a quick re-death ${quickRedeathRate}; outcomes ${outcomes}`);

    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.timeoutRate).toBeLessThanOrEqual(0.03);
    expect(summary.winRate).toBeGreaterThanOrEqual(0.6);
    expect(summary.winRate).toBeLessThanOrEqual(0.85);
    expect(summary.medianSeconds).toBeGreaterThanOrEqual(120);
    expect(summary.medianSeconds).toBeLessThanOrEqual(420);
    expect(earlyLoss).toBeLessThanOrEqual(0.02);
    // Waves never open with a rock on top of the ship, and respawns are protected
    expect(worstSpawnClearance).toBeGreaterThanOrEqual(150);
    expect(quickRedeathRate).toBeLessThanOrEqual(0.05);
    // Hunting the last fast fragment can drag a little, but no rock is ever out of reach
    expect(longScoreGapRate).toBeLessThanOrEqual(0.05);
    expect(worstScoreGap).toBeLessThan(90);
  }, 900_000);

  test('idle pilot never clears the field', async () => {
    const { summary } = await run(() => idleBot, 40, 900);
    report('Asteroids / idle', summary);
    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.winRate).toBeLessThanOrEqual(0.05);
  }, 900_000);
});
