import { LasatGame } from '../../LasatGame';
import { FPS, describePlayability, holdKeys, playMany, report, type RunResult } from './harness';

type Vec = { x: number; y: number };
type Body = { position: Vec; velocity: Vec; size: number };
type EnemyView = Body & { type: string; alive: boolean; health: number; maxHealth: number };
type PowerUpView = { position: Vec; type: string };

/** Only what a player can see on screen (or in the HUD). */
type LasatView = {
  gameState: 'start' | 'select' | 'playing' | 'gameOver';
  player: Body & {
    health: number;
    maxHealth: number;
    weaponEnergy: { laser: number; ion: number };
    heatseekingMissiles: number;
    deathBlossomReady: boolean;
    deathBlossomCooldown: number;
  };
  enemies: EnemyView[];
  enemyProjectiles: (Body & { type: string; damage: number; alive: boolean })[];
  powerUps: PowerUpView[];
  lives: number;
  score: number;
  ragnarokPhase: number;
  bossActive: boolean;
  finaleSequence: { active: boolean };
  width: number;
  height: number;
};

const view = (game: LasatGame) => game as unknown as LasatView;

const REACTION_FRAMES = 12;
const DECISION_INTERVAL_FRAMES = 6;
const SPECIAL_TAP_INTERVAL_FRAMES = 40;

interface Seen { x: number; y: number; vx: number; vy: number; size: number }
interface SeenEnemy extends Seen { ref: EnemyView; type: string }

/**
 * Human-like Gunstar pilot. It sees bullets and ships as they were ~0.2 s ago and
 * extrapolates their motion imperfectly, re-plans ~10 times a second, sometimes fails
 * to notice a bullet, lines up under a target with a per-target aim error, taps the
 * specials when the HUD shows they are ready, grabs nearby power-ups, and has
 * occasional half-second lapses of attention.
 */
function humanLikeBot() {
  const bulletHistory: Seen[][] = [];
  const enemyHistory: SeenEnemy[][] = [];
  let startAt = 30;
  let initialised = false;
  let nextDecision = 0;
  let lapseUntil = -1;
  let moveKeys: string[] = [];
  let fire = false;
  let targetRef: EnemyView | null = null;
  let aimError = 0;
  let retargetAt = 0;
  let lastIon = -1000;
  let lastMissile = -1000;
  let lastBlossom = -1000;
  let extrapolation = 1;

  return (game: LasatGame, frame: number, rng: () => number) => {
    const v = view(game);
    if (!initialised) {
      initialised = true;
      startAt = 30 + Math.floor(rng() * 60);
    }
    if (v.gameState !== 'playing') {
      holdKeys(game, v.gameState === 'start' && frame === startAt ? ['Enter'] : []);
      return;
    }
    if (v.finaleSequence.active) { holdKeys(game, []); return; }

    bulletHistory.push(v.enemyProjectiles.map(p => ({ x: p.position.x, y: p.position.y, vx: p.velocity.x, vy: p.velocity.y, size: p.size })));
    enemyHistory.push(v.enemies.filter(e => e.alive).map(e => ({
      ref: e, type: e.type, x: e.position.x, y: e.position.y, vx: e.velocity.x, vy: e.velocity.y, size: e.size,
    })));
    if (bulletHistory.length > REACTION_FRAMES + 1) bulletHistory.shift();
    if (enemyHistory.length > REACTION_FRAMES + 1) enemyHistory.shift();
    const lag = bulletHistory.length - 1;

    if (frame < lapseUntil) { holdKeys(game, fire ? [...moveKeys, 'Space'] : moveKeys); return; }
    if (rng() < 0.003) {
      lapseUntil = frame + 20 + Math.floor(rng() * 20);
      holdKeys(game, moveKeys);
      return;
    }

    const ship = v.player;
    const sx = ship.position.x, sy = ship.position.y;
    const W = v.width, H = v.height;
    const extra: string[] = [];

    if (frame >= nextDecision) {
      nextDecision = frame + DECISION_INTERVAL_FRAMES;
      extrapolation = 0.75 + rng() * 0.35;
      const bullets = bulletHistory[0]
        .filter(() => rng() > 0.08)
        .map(b => ({ ...b, x: b.x + b.vx * lag * extrapolation, y: b.y + b.vy * lag * extrapolation }));
      const enemies = enemyHistory[0]
        .filter(e => e.ref.alive)
        .map(e => ({ ...e, x: e.x + e.vx * lag * extrapolation, y: e.y + e.vy * lag * extrapolation }));

      // Threat: the most imminent bullet whose closest approach comes near the ship
      let threat: { t: number; cx: number; cy: number; vx: number; vy: number } | null = null;
      const margin = 10 + rng() * 10;
      for (const b of bullets) {
        const rx = b.x - sx, ry = b.y - sy;
        const v2 = b.vx * b.vx + b.vy * b.vy;
        if (v2 === 0) continue;
        const t = Math.max(0, Math.min(50, -(rx * b.vx + ry * b.vy) / v2));
        const cx = rx + b.vx * t, cy = ry + b.vy * t;
        const miss = Math.hypot(cx, cy) - (b.size + ship.size) / 2;
        if (miss < margin && (threat === null || t < threat.t)) threat = { t, cx, cy, vx: b.vx, vy: b.vy };
      }

      // Target: re-pick every ~0.5 s or when the target dies
      if (!targetRef || !targetRef.alive || frame >= retargetAt) {
        let best: SeenEnemy | null = null;
        let bestScore = Infinity;
        for (const e of enemies) {
          const bias = e.type === 'mothership' ? -150 : e.type === 'sinistar_boss' ? (enemies.length > 4 ? 250 : -100) : 0;
          const s = Math.abs(e.x - sx) + bias + rng() * 60;
          if (s < bestScore) { bestScore = s; best = e; }
        }
        if (best?.ref !== targetRef) aimError = (rng() * 2 - 1) * Math.min(18, best ? best.size * 0.35 : 10);
        targetRef = best?.ref ?? null;
        retargetAt = frame + 30;
      }
      const target = enemies.find(e => e.ref === targetRef) ?? null;

      // Power-up worth grabbing nearby, in the lower part of the screen
      const wanted = v.powerUps.find(p => {
        const useful = p.type !== 'health' || ship.health < ship.maxHealth * 0.7;
        return useful && p.position.y > H * 0.55 && Math.hypot(p.position.x - sx, p.position.y - sy) < 250;
      });

      let goalX = target ? target.x + aimError : W / 2;
      let goalY = H - 110;
      if (wanted && !threat) { goalX = wanted.position.x; goalY = wanted.position.y; }
      // Keep some distance from ships hovering low
      const close = enemies.filter(e => Math.hypot(e.x - sx, e.y - sy) < e.size / 2 + 90);
      if (close.length > 0) goalY = Math.max(goalY, Math.min(H - 40, close[0].y + close[0].size / 2 + 120));

      moveKeys = [];
      if (threat) {
        // Step perpendicular to the bullet's path, away from where it will pass
        const len = Math.hypot(threat.vx, threat.vy);
        let px = -threat.vy / len, py = threat.vx / len;
        if (px * -threat.cx + py * -threat.cy < 0) { px = -px; py = -py; }
        if (Math.abs(threat.cx) < 3 && Math.abs(threat.cy) < 3 && (sx < W / 2) !== (px > 0)) { px = -px; py = -py; }
        if ((sx < 60 && px < 0) || (sx > W - 60 && px > 0)) { px = -px; py = -py; }
        if (px < -0.38) moveKeys.push('KeyA'); else if (px > 0.38) moveKeys.push('KeyD');
        if (py < -0.38 && sy > H * 0.65) moveKeys.push('KeyW'); else if (py > 0.38) moveKeys.push('KeyS');
      } else {
        if (goalX < sx - 8) moveKeys.push('KeyA'); else if (goalX > sx + 8) moveKeys.push('KeyD');
        if (goalY < sy - 10) moveKeys.push('KeyW'); else if (goalY > sy + 10) moveKeys.push('KeyS');
      }

      const above = enemies.filter(e => e.y < sy && Math.abs(e.x - sx) < e.size / 2 + 8);
      fire = above.length > 0 || rng() < 0.15;

      const aligned = target && Math.abs(target.x - sx) < target.size / 2 + 6 && target.y < sy;
      const big = target && target.type !== 'fighter';
      if (aligned && big && ship.weaponEnergy.ion >= 20 && frame - lastIon > SPECIAL_TAP_INTERVAL_FRAMES && rng() < 0.5) {
        extra.push('KeyX');
        lastIon = frame;
      }
      const bigVisible = enemies.some(e => e.type === 'mothership' || e.type === 'sinistar_boss');
      if (ship.heatseekingMissiles > 0 && bigVisible && frame - lastMissile > 90 && rng() < 0.3) {
        extra.push('KeyC');
        lastMissile = frame;
      }
      const near = enemies.filter(e => Math.hypot(e.x - sx, e.y - sy) < 140).length;
      const blossomReady = ship.deathBlossomReady && ship.deathBlossomCooldown <= 0;
      const panic = near >= 3 || (near >= 1 && ship.health < ship.maxHealth * 0.3);
      if (blossomReady && panic && frame - lastBlossom > 60 && rng() < 0.25) {
        extra.push('KeyZ');
        lastBlossom = frame;
      }
    }

    holdKeys(game, [...moveKeys, ...(fire ? ['Space'] : []), ...extra]);
  };
}

/** Presses Enter once to start, then never touches the controls. */
const idleBot = (game: LasatGame, frame: number) => holdKeys(game, frame === 30 ? ['Enter'] : []);

const DAMAGE_SOURCES = [
  'fighter_shot', 'destroyer_shot', 'mothership_shot', 'destroyer_blast', 'turret_shot', 'sinistar_boss_shot', 'boss_death_blossom',
];

function makeMetrics(): Record<string, number> {
  return {
    firstDamageSec: Infinity,
    damageBefore5s: 0,
    deathsFirst20s: 0,
    lostBefore20s: 0,
    livesLost: 0,
    phaseReached: 1,
    wave1Sec: NaN,
    wave2Sec: NaN,
    wave3Sec: NaN,
    bossFightSec: NaN,
    finaleSec: NaN,
    longestScoreGapSec: 0,
    livesLeftOnWin: NaN,
    ...Object.fromEntries(DAMAGE_SOURCES.map(s => [`dmg_${s}`, 0])),
    ...Object.fromEntries([1, 2, 3, 4].map(p => [`deathsPhase${p}`, 0])),
  };
}

/** Records pacing and fairness from what is on screen. Times are measured from pressing start. */
function observer(metrics: Record<string, number>) {
  let startFrame: number | null = null;
  let prev: { health: number; lives: number; phase: number; score: number; boss: boolean; finale: boolean } | null = null;
  let waveStart = 0, bossStart = 0, finaleStart = 0, scoreAt = 0;
  return (game: LasatGame, frame: number) => {
    const v = view(game);
    if (startFrame === null) {
      if (v.gameState !== 'playing') return;
      startFrame = frame;
    }
    const sec = (frame - startFrame + 1) / FPS;
    const now = { health: v.player.health, lives: v.lives, phase: v.ragnarokPhase, score: v.score, boss: v.bossActive, finale: v.finaleSequence.active };
    const bullets = v.enemyProjectiles;
    if (!prev) { prev = now; return; }

    if (now.lives < prev.lives || (now.lives === prev.lives && now.health < prev.health)) {
      if (!Number.isFinite(metrics.firstDamageSec)) metrics.firstDamageSec = sec;
      if (sec <= 5) metrics.damageBefore5s = 1;
      // A bullet that hits the ship is flagged dead that frame and swept on the next
      for (const b of bullets) {
        const key = `dmg_${b.type}`;
        if (!b.alive && key in metrics) metrics[key] += b.damage;
      }
    }
    if (now.lives < prev.lives) {
      metrics.livesLost += prev.lives - now.lives;
      metrics[`deathsPhase${Math.min(4, prev.phase)}`] += prev.lives - now.lives;
      if (sec <= 20) metrics.deathsFirst20s += prev.lives - now.lives;
      if (now.lives <= 0 && sec <= 20) metrics.lostBefore20s = 1;
    }
    if (now.phase > prev.phase) {
      if (prev.phase <= 3) metrics[`wave${prev.phase}Sec`] = sec - waveStart;
      waveStart = sec;
      metrics.phaseReached = now.phase;
    }
    if (now.boss && !prev.boss) bossStart = sec;
    if (now.finale && !prev.finale) { finaleStart = sec; metrics.bossFightSec = sec - bossStart; }
    if (!now.finale && prev.finale) { metrics.finaleSec = sec - finaleStart; metrics.livesLeftOnWin = now.lives; }
    if (now.score !== prev.score) {
      if (!now.finale) metrics.longestScoreGapSec = Math.max(metrics.longestScoreGapSec, sec - scoreAt);
      scoreAt = sec;
    }
    prev = now;
  };
}

type Bot = (game: LasatGame, frame: number, rng: () => number) => void;

/** playMany calls makeMetrics right before each session, so a fresh bot and probe are built there. */
async function run(makeBot: () => Bot, count: number, maxSeconds: number) {
  let bot: Bot = makeBot();
  let observe: ((game: LasatGame, frame: number) => void) | null = null;
  return playMany(LasatGame, count, {
    maxSeconds,
    bot: (game, frame, rng) => bot(game, frame, rng),
    observe: (game, frame) => observe?.(game, frame),
  }, () => {
    const metrics = makeMetrics();
    bot = makeBot();
    observe = observer(metrics);
    return metrics;
  });
}

function rate(results: RunResult[], pred: (r: RunResult) => boolean) {
  return results.filter(pred).length / results.length;
}

const MAX_SECONDS = 900;

describePlayability('Lasat Starfighter playability', () => {
  test('human-like pilot: fair, winnable, and finishes in a few minutes', async () => {
    const { summary, results } = await run(humanLikeBot, Number(process.env.LASAT_RUNS ?? 60), MAX_SECONDS);
    report('Lasat / human-like', summary);
    const earlyLoss = rate(results, r => r.metrics.damageBefore5s > 0 || r.metrics.lostBefore20s > 0);
    const outcomes = results.map(r => `${r.outcome[0]}${Math.round(r.seconds)}:P${r.metrics.phaseReached}`).join(' ');
    const means = Object.keys(results[0].metrics)
      .filter(k => k.startsWith('dmg_') || k.startsWith('deathsPhase'))
      .map(k => `${k}=${(results.reduce((s, r) => s + r.metrics[k], 0) / results.length).toFixed(1)}`);
    console.info(`[playability] Lasat early-loss rate ${earlyLoss}; means ${means.join(' ')}\noutcomes ${outcomes}`);

    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.timeoutRate).toBeLessThanOrEqual(0.03);
    expect(summary.winRate).toBeGreaterThanOrEqual(0.5);
    expect(summary.winRate).toBeLessThanOrEqual(0.75);
    expect(summary.medianSeconds).toBeGreaterThanOrEqual(150);
    expect(summary.medianSeconds).toBeLessThanOrEqual(540);
    expect(earlyLoss).toBeLessThanOrEqual(0.02);
  }, 1_800_000);

  test('idle pilot never wins', async () => {
    const { summary, results } = await run(() => idleBot, 40, MAX_SECONDS);
    report('Lasat / idle', summary);
    console.info(`[playability] Lasat idle outcomes ${results.map(r => `${r.outcome[0]}${Math.round(r.seconds)}`).join(' ')}`);
    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.winRate).toBeLessThanOrEqual(0.05);
  }, 1_800_000);
});
