import { BreakoutGame } from '../../BreakoutGame';
import { FPS, describePlayability, holdKeys, playMany, reacted, report, type RunResult } from './harness';

type BallView = { x: number; y: number; dx: number; dy: number; radius: number; speed: number };
type BrickView = { x: number; y: number; width: number; height: number; destroyed: boolean };
type BreakoutView = {
  balls: BallView[];
  bricks: BrickView[];
  paddle: { x: number; y: number; width: number; height: number };
  lives: number;
  score: number;
  width: number;
  paddleEvolved: boolean;
  evolvedPaddleX: number;
  evolvedPaddleY: number;
  punchCooldownLeft: number;
  punchCooldownRight: number;
};

const view = (game: BreakoutGame) => game as unknown as BreakoutView;

const REACTION_FRAMES = 12;
const AIM_ERROR_PX = 22;
/** Players misread the ball's angle a little, so long or wall-bounced paths are judged worse. */
const ANGLE_MISREAD = 0.12;
/** How far off-center the player deliberately hits the ball to steer it toward the blocks. */
const STEER_PX = 22;
const PUNCH_REACH = 50;

/** Where a descending ball will cross `targetY`, folding the path off the side walls like a player would eyeball it. */
function landingX(ball: BallView, targetY: number, width: number, misread: number): number {
  const vy = ball.dy * ball.speed;
  if (vy <= 0) return ball.x;
  const t = (targetY - ball.y) / vy;
  const span = width - 2 * ball.radius;
  let x = ball.x - ball.radius + ball.dx * ball.speed * (1 + misread) * t;
  x = ((x % (2 * span)) + 2 * span) % (2 * span);
  if (x > span) x = 2 * span - x;
  return x + ball.radius;
}

/** The descending ball that will reach the paddle first, else the lowest ball. */
function threat(balls: BallView[], paddleY: number): BallView | null {
  let best: BallView | null = null;
  let bestT = Infinity;
  for (const b of balls) {
    const vy = b.dy * b.speed;
    const t = vy > 0 ? (paddleY - b.y) / vy : 1e6 + (paddleY - b.y);
    if (t < bestT) { bestT = t; best = b; }
  }
  return best;
}

/**
 * Human-like Breakout player: re-reads the threatening ball ~0.2 s after it bounces or a
 * new ball appears, estimates where it will land (with a per-read aiming error of up to
 * ±22 px), and steers the paddle with A/D. After the paddle evolves it walks to the
 * nearest visible block and punches it, again with reaction delay and positioning error.
 */
function humanLikeBot() {
  let lastSignature = '';
  let changedAt: number | null = 0;
  let aimError = 0;
  let misread = 0;
  let plannedX: number | null = null;
  let punchTarget: BrickView | null = null;
  let punchTargetSince: number | null = null;
  let punchError = { x: 0, y: 0 };

  return (game: BreakoutGame, frame: number, rng: () => number) => {
    const g = view(game);

    if (g.paddleEvolved) {
      if (!punchTarget || punchTarget.destroyed) {
        let best: BrickView | null = null;
        let bestD = Infinity;
        for (const b of g.bricks) {
          if (b.destroyed) continue;
          const d = Math.hypot(b.x + b.width / 2 - g.evolvedPaddleX, b.y + b.height / 2 - g.evolvedPaddleY);
          if (d < bestD) { bestD = d; best = b; }
        }
        punchTarget = best;
        punchTargetSince = frame;
        punchError = { x: (rng() * 2 - 1) * 10, y: (rng() * 2 - 1) * 8 };
      }
      if (!punchTarget || !reacted(frame, punchTargetSince, REACTION_FRAMES)) { holdKeys(game, []); return; }
      const cx = punchTarget.x + punchTarget.width / 2;
      const cy = punchTarget.y + punchTarget.height / 2;
      const useLeft = g.evolvedPaddleX >= cx;
      const wantX = cx + (useLeft ? PUNCH_REACH : -PUNCH_REACH) + punchError.x;
      const wantY = cy + punchError.y;
      const keys: string[] = [];
      if (wantX < g.evolvedPaddleX - 3) keys.push('KeyA');
      else if (wantX > g.evolvedPaddleX + 3) keys.push('KeyD');
      if (wantY < g.evolvedPaddleY - 3) keys.push('KeyW');
      else if (wantY > g.evolvedPaddleY + 3) keys.push('KeyS');
      if (Math.abs(wantX - g.evolvedPaddleX) < 14 && Math.abs(wantY - g.evolvedPaddleY) < 14) {
        keys.push(useLeft ? 'KeyZ' : 'KeyX');
      }
      holdKeys(game, keys);
      return;
    }

    const ball = threat(g.balls, g.paddle.y);
    const signature = ball ? `${g.balls.length}:${Math.sign(ball.dx)}:${Math.sign(ball.dy)}` : 'none';
    if (signature !== lastSignature) {
      lastSignature = signature;
      changedAt = frame;
      aimError = (rng() * 2 - 1) * AIM_ERROR_PX;
      misread = (rng() * 2 - 1) * ANGLE_MISREAD;
    }
    if (ball && reacted(frame, changedAt, REACTION_FRAMES)) {
      const descending = ball.dy > 0;
      const x = descending ? landingX(ball, g.paddle.y, g.width, misread) : (ball.x + g.width / 2) / 2;
      // Hit the ball on the side away from the blocks so it heads back toward them
      const remaining = g.bricks.filter(b => !b.destroyed);
      const blocksX = remaining.length > 0
        ? remaining.reduce((sum, b) => sum + b.x + b.width / 2, 0) / remaining.length
        : g.width / 2;
      const steer = descending ? -Math.max(-1, Math.min(1, (blocksX - x) / 150)) * STEER_PX : 0;
      plannedX = x + steer + aimError;
    }
    const center = g.paddle.x + g.paddle.width / 2;
    const target = plannedX ?? center;
    holdKeys(game, target < center - 6 ? ['KeyA'] : target > center + 6 ? ['KeyD'] : []);
  };
}

function idleBot() {
  return (game: BreakoutGame) => holdKeys(game, []);
}

function makeMetrics(): Record<string, number> {
  return {
    firstLifeLostSec: NaN,
    livesLost: 0,
    deathsFirst20s: 0,
    /** Longest stretch of ball play without a block breaking. */
    longestBreakGapSec: 0,
    evolvedAtSec: NaN,
    maxBallSpeed: 0,
    paddleReturns: 0,
    /** Returns caught within 12 px of the paddle's edge: a proxy for tension. */
    closeCalls: 0,
    /** How far outside the paddle's reach the last ball passed when a life was lost (small = fair near-miss). */
    avgMissPx: NaN,
  };
}

function observer() {
  let lastLives: number | null = null;
  let prevBall: BallView | null = null;
  let prevPaddleCenter = 0;
  let prevHalfReach = 0;
  let missPxTotal = 0;
  let missCount = 0;
  let lastLeft = -1;
  let lastBreakFrame = 0;
  const lastDy = new WeakMap<BallView, number>();
  return (metrics: Record<string, number>) => (game: BreakoutGame, frame: number) => {
    const g = view(game);
    for (const b of g.balls) {
      const prev = lastDy.get(b);
      if (prev !== undefined && prev > 0 && b.dy < 0 && b.y > g.paddle.y - 30) {
        metrics.paddleReturns++;
        const margin = g.paddle.width / 2 + b.radius - Math.abs(b.x - (g.paddle.x + g.paddle.width / 2));
        if (margin < 12) metrics.closeCalls++;
      }
      lastDy.set(b, b.dy);
    }
    if (lastLives === null) lastLives = g.lives;
    if (g.lives < lastLives) {
      const lost = lastLives - g.lives;
      if (prevBall) {
        missPxTotal += Math.abs(prevBall.x - prevPaddleCenter) - prevHalfReach;
        missCount++;
        metrics.avgMissPx = missPxTotal / missCount;
      }
      metrics.livesLost += lost;
      if (!Number.isFinite(metrics.firstLifeLostSec)) metrics.firstLifeLostSec = frame / FPS;
      if (frame < 20 * FPS) metrics.deathsFirst20s += lost;
    }
    lastLives = g.lives;
    const left = g.bricks.filter(b => !b.destroyed).length;
    if (left !== lastLeft) {
      lastLeft = left;
      lastBreakFrame = frame;
    } else if (!g.paddleEvolved) {
      metrics.longestBreakGapSec = Math.max(metrics.longestBreakGapSec, (frame - lastBreakFrame) / FPS);
    }
    prevBall = g.balls.length === 1 ? { ...g.balls[0] } : null;
    prevPaddleCenter = g.paddle.x + g.paddle.width / 2;
    prevHalfReach = g.paddle.width / 2 + (prevBall?.radius ?? 0);
    if (g.paddleEvolved && !Number.isFinite(metrics.evolvedAtSec)) metrics.evolvedAtSec = frame / FPS;
    for (const b of g.balls) metrics.maxBallSpeed = Math.max(metrics.maxBallSpeed, b.speed);
  };
}

/** Wraps playMany so each session gets a fresh observer bound to its own metrics object. */
async function play(bot: () => (game: BreakoutGame, frame: number, rng: () => number) => void, count: number, maxSeconds: number) {
  let currentBot = bot();
  let currentObserve: (game: BreakoutGame, frame: number) => void = () => {};
  const metricsFactory = () => {
    const m = makeMetrics();
    currentBot = bot();
    currentObserve = observer()(m);
    return m;
  };
  return playMany(BreakoutGame, count, {
    maxSeconds,
    bot: (game, frame, rng) => currentBot(game, frame, rng),
    observe: (game, frame) => currentObserve(game, frame),
  }, metricsFactory);
}

function earlyLossRate(results: RunResult[]) {
  const earlyLife = results.filter(r => r.metrics.firstLifeLostSec < 5).length;
  const earlyGame = results.filter(r => r.outcome === 'lost' && r.seconds < 20).length;
  return { earlyLifeLossRate: earlyLife / results.length, earlyGameLossRate: earlyGame / results.length };
}

const MAX_SECONDS = 900;

describePlayability('Breakout playability', () => {
  test('human-like player: fair, winnable, and finishes in a few minutes', async () => {
    const { summary, results } = await play(humanLikeBot, 60, MAX_SECONDS);
    const early = earlyLossRate(results);
    report('Breakout / human-like', summary);
    console.info(`[playability] Breakout / human-like early losses ${JSON.stringify(early)}\noutcomes ${results.map(r => `${r.outcome[0]}${Math.round(r.seconds)}/${r.metrics.livesLost}`).join(' ')}`);

    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.timeoutRate).toBeLessThanOrEqual(0.03);
    expect(summary.winRate).toBeGreaterThanOrEqual(0.7);
    expect(summary.winRate).toBeLessThanOrEqual(0.9);
    expect(summary.medianSeconds).toBeGreaterThanOrEqual(120);
    expect(summary.medianSeconds).toBeLessThanOrEqual(420);
    expect(early.earlyLifeLossRate).toBeLessThanOrEqual(0.02);
    expect(early.earlyGameLossRate).toBeLessThanOrEqual(0.02);
  }, 1_200_000);

  test('idle player does not win', async () => {
    const { summary, results } = await play(idleBot, 40, MAX_SECONDS);
    report('Breakout / idle', summary);
    console.info(`[playability] Breakout / idle outcomes ${results.map(r => `${r.outcome[0]}${Math.round(r.seconds)}`).join(' ')}`);

    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.winRate).toBeLessThanOrEqual(0.05);
  }, 1_200_000);
});
