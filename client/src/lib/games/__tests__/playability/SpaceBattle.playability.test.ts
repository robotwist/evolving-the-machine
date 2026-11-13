import { StarWarsGame } from '../../StarWarsGame';
import { FPS, describePlayability, holdKeys, playMany, report, type RunResult } from './harness';

type Vec = { x: number; y: number };

/** Only what a player can see on screen (or in the HUD). */
type SpaceBattleView = {
  player: { position: Vec; velocity: Vec; rotation: number; size: number; health: number; shield: number; alive: boolean };
  enemies: Array<{ position: Vec; velocity: Vec; size: number; alive: boolean }>;
  starDestroyer: { position: Vec; alive: boolean; weakPoints: Array<{ x: number; y: number; destroyed: boolean }> };
  bullets: Array<{ position: Vec; velocity: Vec; owner: 'player' | 'enemy' | 'boss'; size: number }>;
  powerups: Array<{ position: Vec }>;
  phase: 'enemy-ships' | 'star-destroyer' | 'victory';
  transitioning: boolean;
  enemiesDestroyed: number;
  score: number;
  width: number;
  height: number;
};

const view = (game: StarWarsGame) => game as unknown as SpaceBattleView;

const REACTION_FRAMES = 12;
const KEY_REPEAT_DELAY_FRAMES = 30;
const KEY_REPEAT_INTERVAL_FRAMES = 2;
const PLAYER_BULLET_SPEED = 14.4;
/** Chance a human notices any given incoming shot at all. */
const NOTICE_CHANCE = 0.85;
/** Per-shot error in judging how close a shot will pass (px). */
const DODGE_JUDGEMENT_PX = 12;
/** How many incoming shots a player can track at once. */
const TRACKED_SHOTS = 4;
const LOOKAHEAD_FRAMES = 60;
const PREFERRED_RANGE = { min: 200, max: 360 };
const EDGE_MARGIN = 70;

interface Seen { ref: object; x: number; y: number; vx: number; vy: number; size: number }

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Drives the game the way a browser does: keys in `keys` are held, each new press sends
 * a keydown, and held keys auto-repeat after the OS delay. Works for both held-key and
 * per-keydown control schemes.
 */
function keyboard() {
  const heldSince = new Map<string, number>();
  return (game: StarWarsGame, frame: number, keys: string[]) => {
    for (const code of Array.from(heldSince.keys())) if (!keys.includes(code)) heldSince.delete(code);
    holdKeys(game, keys);
    for (const code of keys) {
      const since = heldSince.get(code);
      const held = since === undefined ? 0 : frame - since;
      if (since === undefined) heldSince.set(code, frame);
      const repeat = held >= KEY_REPEAT_DELAY_FRAMES && (held - KEY_REPEAT_DELAY_FRAMES) % KEY_REPEAT_INTERVAL_FRAMES === 0;
      if (since === undefined || repeat) game.handleInput({ code } as KeyboardEvent);
    }
  };
}

/**
 * Human-like pilot. Sees the field ~0.2 s late (fresh shots register late, a few are
 * missed entirely), extrapolates what it saw, aims with a per-decision angular error,
 * keeps a comfortable range, dodges shots it judges to be on a collision course by
 * thrusting along whichever ship axis is closest to the escape direction, grabs nearby
 * powerups, and has occasional short lapses of attention.
 */
function humanLikeBot() {
  const press = keyboard();
  const history: Array<{ enemies: Seen[]; shots: Seen[]; vessel: Vec }> = [];
  const noticed = new WeakMap<object, boolean>();
  const misjudge = new WeakMap<object, number>();
  let aimError = 0;
  let nextDecision = 0;
  let targetRef: object | null = null;
  let lapseUntil = -1;

  return (game: StarWarsGame, frame: number, rng: () => number) => {
    const v = view(game);
    const seenOf = (b: { position: Vec; velocity: Vec; size: number }): Seen =>
      ({ ref: b, x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y, size: b.size });
    history.push({
      enemies: v.enemies.filter(e => e.alive).map(seenOf),
      shots: v.bullets.filter(b => b.owner !== 'player').map(seenOf),
      vessel: { ...v.starDestroyer.position },
    });
    if (history.length > REACTION_FRAMES + 1) history.shift();
    const lag = history.length - 1;
    const extrapolate = (s: Seen) => ({ ...s, x: s.x + s.vx * lag, y: s.y + s.vy * lag });
    const enemies = history[0].enemies.map(extrapolate);
    const shots = history[0].shots.filter(s => {
      if (!noticed.has(s.ref)) noticed.set(s.ref, rng() < NOTICE_CHANCE);
      return noticed.get(s.ref);
    }).map(extrapolate);
    for (const s of shots) if (!misjudge.has(s.ref)) misjudge.set(s.ref, (rng() * 2 - 1) * DODGE_JUDGEMENT_PX);
    // Attention is limited: only the closest few shots are tracked
    shots.sort((a, b) => Math.hypot(a.x - v.player.position.x, a.y - v.player.position.y) - Math.hypot(b.x - v.player.position.x, b.y - v.player.position.y));
    shots.length = Math.min(shots.length, TRACKED_SHOTS);

    const ship = v.player;
    if (!ship.alive || v.transitioning || v.phase === 'victory') { press(game, frame, []); return; }
    if (frame < lapseUntil) { press(game, frame, []); return; }
    if (rng() < 0.003) { lapseUntil = frame + 24; press(game, frame, []); return; }

    const keys: string[] = [];
    const px = ship.position.x, py = ship.position.y;
    const facing = { x: Math.cos(ship.rotation), y: Math.sin(ship.rotation) };
    const steerTo = (angle: number, tolerance: number) => {
      const diff = wrapAngle(angle - ship.rotation);
      if (diff > tolerance) keys.push('KeyD');
      else if (diff < -tolerance) keys.push('KeyA');
      return diff;
    };

    // Threat: the earliest noticed shot whose closest approach comes too near
    let threat: { t: number; dx: number; dy: number } | null = null;
    for (const s of shots) {
      const rx = s.x - px, ry = s.y - py;
      const rvx = s.vx - ship.velocity.x, rvy = s.vy - ship.velocity.y;
      const rv2 = rvx * rvx + rvy * rvy;
      const t = rv2 > 0 ? Math.max(0, Math.min(LOOKAHEAD_FRAMES, -(rx * rvx + ry * rvy) / rv2)) : 0;
      const cx = rx + rvx * t, cy = ry + rvy * t;
      const miss = Math.hypot(cx, cy) - (ship.size + s.size) / 2 + (misjudge.get(s.ref) ?? 0);
      if (miss < 14 && t > 0 && (threat === null || t < threat.t)) {
        // Escape sideways from the shot's line, away from where it will pass
        const len = Math.hypot(s.vx, s.vy) || 1;
        let ex = -s.vy / len, ey = s.vx / len;
        if (ex * -cx + ey * -cy < 0) { ex = -ex; ey = -ey; }
        // Don't dodge into a wall
        if ((px < 80 && ex < 0) || (px > v.width - 80 && ex > 0) || (py > v.height - 80 && ey > 0) || (py < 80 && ey < 0)) {
          ex = -ex; ey = -ey;
        }
        threat = { t, dx: ex, dy: ey };
      }
    }

    if (frame >= nextDecision) {
      nextDecision = frame + REACTION_FRAMES;
      aimError = (rng() * 2 - 1) * 0.12;
      let best: Seen | null = null;
      let bestD = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(e.x - px, e.y - py);
        if (d < bestD) { bestD = d; best = e; }
      }
      targetRef = best?.ref ?? null;
    }

    // Aim point: the nearest ship, or a remaining weak point on the command vessel
    let aim: { x: number; y: number; vx: number; vy: number } | null = null;
    if (v.phase === 'enemy-ships') {
      const t = enemies.find(e => e.ref === targetRef);
      if (t) aim = t;
    } else if (v.starDestroyer.alive) {
      // Track the vessel's drift as seen a moment ago
      const seenAt = history[0].vessel;
      const next = history[Math.min(1, lag)].vessel;
      const vx = next.x - seenAt.x, vy = next.y - seenAt.y;
      const sx = seenAt.x + vx * lag, sy = seenAt.y + vy * lag;
      const wps = v.starDestroyer.weakPoints.filter(w => !w.destroyed).map(w => ({ x: sx + w.x, y: sy + w.y, vx, vy }));
      wps.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
      aim = wps[0] ?? { x: sx, y: sy + 40, vx, vy };
    }

    const aimAngle = (a: { x: number; y: number; vx: number; vy: number }) => {
      const t = Math.hypot(a.x - px, a.y - py) / PLAYER_BULLET_SPEED;
      return Math.atan2(a.y + a.vy * t - py, a.x + a.vx * t - px) + aimError;
    };

    const cornered = Math.min(px, py, v.width - px, v.height - py) < EDGE_MARGIN;
    if (threat && cornered) {
      // Pinned against a wall: break out toward open space rather than dodge along it
      const len = Math.hypot(v.width / 2 - px, v.height * 0.6 - py) || 1;
      threat = { ...threat, dx: (v.width / 2 - px) / len, dy: (v.height * 0.6 - py) / len };
    }
    if (threat) {
      const along = threat.dx * facing.x + threat.dy * facing.y;
      if (along > 0.35) keys.push('KeyW');
      else if (along < -0.35) keys.push('KeyS');
      const escape = Math.atan2(threat.dy, threat.dx);
      const forwardDiff = wrapAngle(escape - ship.rotation);
      steerTo(Math.abs(forwardDiff) <= Math.PI / 2 ? escape : escape + Math.PI, 0.3);
      // Keep shooting if the nose happens to be on target
      if (aim && Math.abs(wrapAngle(aimAngle(aim) - ship.rotation)) < 0.15) keys.push('Space');
      press(game, frame, keys);
      return;
    }

    const speed = Math.hypot(ship.velocity.x, ship.velocity.y);
    const powerup = v.powerups.find(p => Math.hypot(p.position.x - px, p.position.y - py) < 200);
    if (cornered) {
      // Fly back toward open space instead of fighting from a wall
      const diff = steerTo(Math.atan2(v.height * 0.6 - py, v.width / 2 - px), 0.2);
      if (Math.abs(diff) < 0.6 && speed < 3) keys.push('KeyW');
    } else if (powerup) {
      const diff = steerTo(Math.atan2(powerup.position.y - py, powerup.position.x - px), 0.15);
      if (Math.abs(diff) < 0.5 && speed < 3) keys.push('KeyW');
    } else if (aim) {
      const dist = Math.hypot(aim.x - px, aim.y - py);
      const diff = steerTo(aimAngle(aim), 0.06);
      if (Math.abs(diff) < 0.5 && dist > PREFERRED_RANGE.max && speed < 2.5) keys.push('KeyW');
      if (Math.abs(diff) < 0.8 && dist < PREFERRED_RANGE.min && speed < 2.5) keys.push('KeyS');
      if (Math.abs(diff) < 0.15 && dist < 600) keys.push('Space');
    }
    press(game, frame, keys);
  };
}

const idleBot = (game: StarWarsGame) => holdKeys(game, []);

function makeMetrics(): Record<string, number> {
  return {
    firstDamageSec: Infinity,
    damagedBefore5s: 0,
    lostBefore20s: 0,
    deathsFirst20s: 0,
    enemiesPerMinute: 0,
    enemyPhaseSec: NaN,
    bossFightSec: NaN,
    reachedBoss: 0,
    weakPointsDestroyed: 0,
    deathPhase: 0,
    longestScoreGapSec: 0,
    hpAtBossStart: NaN,
    hpAtVesselDestroyed: NaN,
    enemyPhaseDamagePerMin: 0,
    bossPhaseDamagePerMin: 0,
  };
}

/** Probe that records fairness / pacing metrics from on-screen state only. */
function observer() {
  let prev: { hp: number; score: number; scoreAt: number } | null = null;
  let bossStart: number | null = null;
  const damage = { enemy: 0, boss: 0 };
  return (metrics: Record<string, number>) => (game: StarWarsGame, frame: number) => {
    const v = view(game);
    const sec = (frame + 1) / FPS;
    const hp = v.player.health + v.player.shield;
    if (prev === null) { prev = { hp, score: v.score, scoreAt: 0 }; return; }

    if (hp < prev.hp - 0.01) {
      if (!Number.isFinite(metrics.firstDamageSec)) metrics.firstDamageSec = sec;
      if (sec <= 5) metrics.damagedBefore5s = 1;
      if (v.phase === 'enemy-ships') {
        damage.enemy += prev.hp - hp;
        metrics.enemyPhaseDamagePerMin = damage.enemy / (sec / 60);
      } else if (bossStart !== null && v.starDestroyer.alive) {
        damage.boss += prev.hp - hp;
        metrics.bossPhaseDamagePerMin = damage.boss / ((sec - bossStart) / 60);
      }
    }
    if (v.phase === 'star-destroyer' && !v.transitioning && bossStart === null) metrics.hpAtBossStart = hp;
    if (!v.player.alive && metrics.deathPhase === 0) {
      metrics.deathPhase = v.phase === 'enemy-ships' ? 1 : 2;
      if (sec <= 20) { metrics.lostBefore20s = 1; metrics.deathsFirst20s = 1; }
    }
    if (v.phase === 'enemy-ships') {
      metrics.enemiesPerMinute = v.enemiesDestroyed / (sec / 60);
    } else if (!Number.isFinite(metrics.enemyPhaseSec)) {
      metrics.enemyPhaseSec = sec;
      metrics.reachedBoss = 1;
    }
    if (v.phase === 'star-destroyer' && !v.transitioning && bossStart === null) bossStart = sec;
    metrics.weakPointsDestroyed = v.starDestroyer.weakPoints.filter(w => w.destroyed).length;
    if (bossStart !== null && !v.starDestroyer.alive && !Number.isFinite(metrics.bossFightSec)) {
      metrics.bossFightSec = sec - bossStart;
      metrics.hpAtVesselDestroyed = hp;
    }
    if (v.score !== prev.score && v.player.alive) {
      metrics.longestScoreGapSec = Math.max(metrics.longestScoreGapSec, sec - prev.scoreAt);
      prev.scoreAt = sec;
    }
    prev.hp = hp;
    prev.score = v.score;
  };
}

type Bot = (game: StarWarsGame, frame: number, rng: () => number) => void;

/** playMany calls makeMetrics right before each session, so a fresh bot and probe are built there. */
async function run(makeBot: () => Bot, count: number, maxSeconds: number) {
  let bot: Bot = makeBot();
  let observe: ((game: StarWarsGame, frame: number) => void) | null = null;
  return playMany(StarWarsGame, count, {
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

describePlayability('Space Battle playability', () => {
  test('human-like pilot: fair, winnable, and finishes in a few minutes', async () => {
    const { summary, results } = await run(humanLikeBot, 50, 720);
    report('Space Battle / human-like', summary);
    const earlyLoss = rate(results, r => r.metrics.damagedBefore5s > 0 || r.metrics.lostBefore20s > 0);
    const reachedBoss = rate(results, r => r.metrics.reachedBoss > 0);
    const outcomes = results.map(r => `${r.outcome[0]}${Math.round(r.seconds)}:P${r.metrics.deathPhase}:W${r.metrics.weakPointsDestroyed}:H${Math.round(r.metrics.hpAtVesselDestroyed)}`).join(' ');
    console.info(`[playability] Space Battle early-loss rate ${earlyLoss}; reached boss ${reachedBoss}; outcomes ${outcomes}`);

    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.timeoutRate).toBeLessThanOrEqual(0.03);
    expect(summary.winRate).toBeGreaterThanOrEqual(0.5);
    expect(summary.winRate).toBeLessThanOrEqual(0.75);
    expect(summary.medianSeconds).toBeGreaterThanOrEqual(120);
    expect(summary.medianSeconds).toBeLessThanOrEqual(480);
    expect(earlyLoss).toBeLessThanOrEqual(0.02);
    // Victory: onStageComplete fires exactly once, after the command vessel is destroyed
    for (const r of results.filter(res => res.outcome === 'won')) {
      expect(r.stageCompleteCalls).toBe(1);
      expect(r.gameOverCalls).toBe(0);
      expect(r.metrics.bossFightSec).toBeGreaterThan(0);
    }
  }, 1_800_000);

  test('idle pilot never wins', async () => {
    const { summary } = await run(() => idleBot, 40, 720);
    report('Space Battle / idle', summary);
    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.winRate).toBeLessThanOrEqual(0.05);
  }, 1_800_000);
});
