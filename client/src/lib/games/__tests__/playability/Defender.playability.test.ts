import { DefenderGame } from '../../DefenderGame';
import { describePlayability, FPS, holdKeys, playMany, reacted, report, type RunResult } from './harness';

type Vec = { x: number; y: number };
type EnemyView = {
  position: Vec;
  velocity: Vec;
  alive: boolean;
  type: string;
  kamikazeMode?: boolean;
  kamikazePhase?: 'telegraph' | 'dive';
  diveTarget?: Vec;
};
type DefenderView = {
  player: { position: Vec; velocity: Vec; health: number; onGround: boolean };
  enemies: EnemyView[];
  enemyBullets: Array<{ position: Vec; velocity: Vec; alive: boolean }>;
  playerBullets: Array<{ alive: boolean }>;
  powerups: Array<{ position: Vec }>;
  camera: { x: number };
  width: number;
  height: number;
  wave: number;
  score: number;
  worldWidth: number;
};

const view = (game: DefenderGame) => game as unknown as DefenderView;

const REACTION_FRAMES = 12;
/** Chance a human never notices a particular bullet or dive. */
const MISS_CHANCE = 0.12;
/** Horizontal distance a human judges "too close" to a falling bullet, before judgement error. */
const BULLET_DANGER_PX = 22;
/** Bullets further away than this (in frames to impact) are not worth tracking yet. */
const BULLET_LOOKAHEAD_FRAMES = 80;
/** How far ahead (frames) the bot checks that its intended path is clear of bullets. */
const PATH_LOOKAHEAD_FRAMES = 20;
/** A diving kamikaze is dodged when its predicted impact is this close. */
const KAMIKAZE_DANGER_PX = 90;
const KAMIKAZE_COMMIT_FRAMES = 30;
/** With less room than this behind them, players dash under a kamikaze instead of away. */
const CORNERED_PX = 200;
const SHIP_HALF_HEIGHT = 15;
const PLAYER_SPEED = 3;
/** The bot's rough sense of how fast its upward shot travels (px/frame). */
const ASSUMED_SHOT_SPEED = 9;

interface Perception {
  firstSeen: number;
  noticed: boolean;
  judgeError: number;
}

/**
 * Human-like Defender pilot. Only reacts to bullets/enemies inside the camera view, ~0.2 s
 * after they appear; misjudges distances, sometimes never notices a bullet, aims under
 * targets with a random offset, fires X (straight up) at a human tapping rate, and sweeps
 * the world when nothing is on screen.
 */
function humanLikeBot() {
  let perceived = new WeakMap<object, Perception>();
  let target: EnemyView | null = null;
  let targetSince: number | null = null;
  let aimOffset = 0;
  let leadFactor = 0.7;
  let sweepDir = 1;
  let dodgeDir = 0;
  let dodgeUntil = -1;
  let dodgeFrom: EnemyView | null = null;
  // playMany reuses one bot for every session, so forget everything when a new game starts.
  let currentGame: DefenderGame | null = null;

  const perceive = (obj: object, frame: number, rng: () => number, judge: number) => {
    let p = perceived.get(obj);
    if (!p) {
      p = { firstSeen: frame, noticed: rng() > MISS_CHANCE, judgeError: (rng() * 2 - 1) * judge };
      perceived.set(obj, p);
    }
    return p;
  };

  return (game: DefenderGame, frame: number, rng: () => number) => {
    if (game !== currentGame) {
      currentGame = game;
      perceived = new WeakMap();
      target = null;
      targetSince = null;
      sweepDir = 1;
      dodgeUntil = -1;
      dodgeFrom = null;
    }
    const v = view(game);
    const p = v.player.position;
    const left = v.camera.x;
    const right = v.camera.x + v.width;
    const onScreen = (pos: Vec) => pos.x >= left && pos.x <= right && pos.y >= 0 && pos.y <= v.height;

    // 1. Kamikaze dives: run away from the attacker (or under it when cornered) and commit.
    if (frame < dodgeUntil) {
      holdKeys(game, [dodgeDir < 0 ? 'KeyA' : 'KeyD']);
      return;
    }
    for (const e of v.enemies) {
      if (!e.alive || !e.kamikazeMode || !onScreen(e.position)) continue;
      const seen = perceive(e, frame, rng, 30);
      if (!seen.noticed || !reacted(frame, seen.firstSeen, REACTION_FRAMES)) continue;
      // Where it will hit: the telegraphed reticle if shown, else straight along its path.
      const impactX = e.diveTarget?.x ?? e.position.x + e.velocity.x * Math.max(0, (p.y - e.position.y) / Math.max(1, e.velocity.y));
      if (Math.abs(impactX - p.x) < KAMIKAZE_DANGER_PX + seen.judgeError) {
        // Pick an escape once per kamikaze: away from it, or under it when cornered by a wall.
        if (dodgeFrom !== e) {
          dodgeFrom = e;
          dodgeDir = p.x < e.position.x ? -1 : 1;
          const room = dodgeDir < 0 ? p.x : v.worldWidth - p.x;
          if (room < CORNERED_PX) dodgeDir = -dodgeDir;
        }
        if (p.x < 20) dodgeDir = 1;
        if (p.x > v.worldWidth - 20) dodgeDir = -1;
        dodgeUntil = frame + KAMIKAZE_COMMIT_FRAMES;
        holdKeys(game, [dodgeDir < 0 ? 'KeyA' : 'KeyD']);
        return;
      }
    }

    // 2. Falling bullets the player has noticed: only move along paths that look clear.
    const bullets: Array<{ x: number; y: number; vy: number; danger: number }> = [];
    for (const b of v.enemyBullets) {
      if (!b.alive || !onScreen(b.position) || b.velocity.y <= 0) continue;
      const seen = perceive(b, frame, rng, 8);
      if (!seen.noticed || !reacted(frame, seen.firstSeen, REACTION_FRAMES)) continue;
      // Still dangerous until it has fallen past the ship's body, not just its center.
      if (b.position.y > p.y + SHIP_HALF_HEIGHT) continue;
      if ((p.y - SHIP_HALF_HEIGHT - b.position.y) / b.velocity.y > BULLET_LOOKAHEAD_FRAMES) continue;
      bullets.push({ x: b.position.x, y: b.position.y, vy: b.velocity.y, danger: BULLET_DANGER_PX + seen.judgeError });
    }
    const pathClear = (dir: number) => bullets.every(b => {
      const arrive = Math.max(0, (p.y - SHIP_HALF_HEIGHT - b.y) / b.vy);
      if (arrive > PATH_LOOKAHEAD_FRAMES) return true;
      const pass = Math.min(PATH_LOOKAHEAD_FRAMES, (p.y + SHIP_HALF_HEIGHT - b.y) / b.vy);
      // Standing still still slides a little on momentum.
      const xa = dir === 0 ? p.x : p.x + dir * PLAYER_SPEED * arrive;
      const xb = dir === 0 ? p.x + v.player.velocity.x * 6 : p.x + dir * PLAYER_SPEED * pass;
      return b.x < Math.min(xa, xb) - b.danger || b.x > Math.max(xa, xb) + b.danger;
    });
    const steer = (desired: number) => {
      for (const dir of [desired, 0, -desired, desired === 0 ? 1 : 0, desired === 0 ? -1 : 0]) {
        if (pathClear(dir)) return dir;
      }
      return desired;
    };

    // 3. Pick and chase a visible target.
    const candidates = v.enemies.filter(e => {
      if (!e.alive || !onScreen(e.position)) return false;
      return reacted(frame, perceive(e, frame, rng, 30).firstSeen, REACTION_FRAMES);
    });
    if (!target || !target.alive || !onScreen(target.position)) {
      target = null;
      let best = Infinity;
      for (const e of candidates) {
        const d = Math.abs(e.position.x - p.x);
        if (d < best) { best = d; target = e; }
      }
      targetSince = target ? frame : null;
      aimOffset = (rng() * 2 - 1) * 10;
      leadFactor = 0.4 + rng() * 0.7;
    }

    const keys: string[] = [];
    let desired = 0;
    if (target && reacted(frame, targetSince, REACTION_FRAMES)) {
      // Humans lead moving targets, but only roughly.
      const travelFrames = Math.max(0, p.y - target.position.y) / ASSUMED_SHOT_SPEED;
      const aimX = target.position.x + target.velocity.x * travelFrames * leadFactor + aimOffset;
      if (aimX < p.x - 5) desired = -1;
      else if (aimX > p.x + 5) desired = 1;
      if (Math.abs(aimX - p.x) < 20 && rng() < 0.75) keys.push('KeyX');
      if (rng() < 0.01) aimOffset = (rng() * 2 - 1) * 10;
    } else if (!target) {
      if (p.x <= 20) sweepDir = 1;
      if (p.x >= v.worldWidth - 20) sweepDir = -1;
      desired = sweepDir;
    }
    const dir = steer(desired);
    if (dir < 0) keys.push('KeyA');
    if (dir > 0) keys.push('KeyD');
    holdKeys(game, keys);
  };
}

function idleBot() {
  return (game: DefenderGame) => holdKeys(game, []);
}

function makeMetrics(): Record<string, number> {
  return {
    firstDamageSec: NaN,
    damagedFirst5s: 0,
    deathsFirst20s: 0,
    bulletHits: 0,
    kamikazeHits: 0,
    longestScoreGapSec: 0,
    wavesCleared: 0,
    kamikazesSeen: 0,
    shots: 0,
    shotHits: 0,
    accuracy: NaN,
    finalHealth: 100,
    wave1Sec: NaN, wave2Sec: NaN, wave3Sec: NaN, wave4Sec: NaN, wave5Sec: NaN,
  };
}

/** Per-run probe; state lives in a closure keyed by the metrics object so runs stay independent. */
function observer() {
  const state = new WeakMap<Record<string, number>, {
    lastHealth: number; lastScore: number; lastScoreFrame: number; wave: number; waveStart: number;
    kamikazes: Set<EnemyView>; bullets: Set<{ alive: boolean }>;
  }>();
  return (metrics: Record<string, number>) => (game: DefenderGame, frame: number) => {
    const v = view(game);
    let s = state.get(metrics);
    if (!s) {
      s = {
        lastHealth: v.player.health, lastScore: v.score, lastScoreFrame: 0, wave: v.wave, waveStart: 0,
        kamikazes: new Set(), bullets: new Set(),
      };
      state.set(metrics, s);
    }
    const sec = (frame + 1) / FPS;

    const bullets = new Set(v.playerBullets);
    bullets.forEach(b => { if (!s.bullets.has(b)) metrics.shots++; });
    s.bullets.forEach(b => { if (!bullets.has(b) && !b.alive) metrics.shotHits++; });
    s.bullets = bullets;
    if (metrics.shots > 0) metrics.accuracy = metrics.shotHits / metrics.shots;

    const aliveKamikazes = new Set(v.enemies.filter(e => e.alive && e.kamikazeMode));
    aliveKamikazes.forEach(k => { if (!s.kamikazes.has(k)) metrics.kamikazesSeen++; });
    if (v.player.health < s.lastHealth) {
      const kamikazeDied = Array.from(s.kamikazes).some(k => !k.alive);
      if (kamikazeDied) metrics.kamikazeHits++;
      else metrics.bulletHits++;
      if (!Number.isFinite(metrics.firstDamageSec)) metrics.firstDamageSec = sec;
      if (sec <= 5) metrics.damagedFirst5s = 1;
      if (v.player.health <= 0 && sec <= 20) metrics.deathsFirst20s = 1;
    }
    s.kamikazes = aliveKamikazes;
    s.lastHealth = v.player.health;
    metrics.finalHealth = Math.max(0, v.player.health);

    if (v.score !== s.lastScore) {
      s.lastScore = v.score;
      s.lastScoreFrame = frame;
    }
    metrics.longestScoreGapSec = Math.max(metrics.longestScoreGapSec, (frame - s.lastScoreFrame) / FPS);

    const stageCleared = v.wave === 5 && v.player.health > 0 && v.enemies.every(e => !e.alive);
    if (v.wave !== s.wave || (stageCleared && metrics.wavesCleared < 5)) {
      if (s.wave >= 1 && s.wave <= 5) metrics[`wave${s.wave}Sec`] = (frame - s.waveStart) / FPS;
      metrics.wavesCleared = stageCleared ? 5 : Math.min(5, v.wave - 1);
      s.wave = v.wave;
      s.waveStart = frame;
    }
  };
}

function earlyStats(results: RunResult[]) {
  const n = results.length;
  return {
    damagedFirst5sRate: results.filter(r => r.metrics.damagedFirst5s).length / n,
    lostFirst20sRate: results.filter(r => r.outcome === 'lost' && r.seconds <= 20).length / n,
    outcomes: results.map(r => `${r.outcome[0]}${Math.round(r.seconds)}/w${r.metrics.wavesCleared}`).join(' '),
  };
}

const SESSIONS = 50;
const MAX_SECONDS = 900;

describePlayability('Defender playability', () => {
  test('human-like player: fair, winnable, and finishes in a few minutes', async () => {
    const observe = observer();
    let current: Record<string, number> = makeMetrics();
    const { summary, results } = await playMany(
      DefenderGame,
      SESSIONS,
      { maxSeconds: MAX_SECONDS, bot: humanLikeBot(), observe: (g, f) => observe(current)(g, f) },
      () => (current = makeMetrics())
    );
    report('Defender / human-like', summary);
    const early = earlyStats(results);
    console.info(`[playability] Defender / human-like early\n${JSON.stringify(early, null, 2)}`);

    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.timeoutRate).toBeLessThanOrEqual(0.03);
    expect(summary.winRate).toBeGreaterThanOrEqual(0.55);
    expect(summary.winRate).toBeLessThanOrEqual(0.8);
    expect(summary.medianSeconds).toBeGreaterThanOrEqual(120);
    expect(summary.medianSeconds).toBeLessThanOrEqual(480);
    expect(early.damagedFirst5sRate).toBeLessThanOrEqual(0.02);
    expect(early.lostFirst20sRate).toBeLessThanOrEqual(0.02);
  }, 1_200_000);

  test('idle player does not win', async () => {
    const observe = observer();
    let current: Record<string, number> = makeMetrics();
    const { summary, results } = await playMany(
      DefenderGame,
      SESSIONS,
      { maxSeconds: MAX_SECONDS, bot: idleBot(), observe: (g, f) => observe(current)(g, f) },
      () => (current = makeMetrics())
    );
    report('Defender / idle', summary);
    const early = earlyStats(results);
    console.info(`[playability] Defender / idle early\n${JSON.stringify(early, null, 2)}`);

    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.winRate).toBeLessThanOrEqual(0.05);
    expect(early.damagedFirst5sRate).toBeLessThanOrEqual(0.02);
    expect(early.lostFirst20sRate).toBeLessThanOrEqual(0.02);
  }, 1_200_000);
});
