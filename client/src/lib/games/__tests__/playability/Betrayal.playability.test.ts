import { BetrayalGame } from '../../BetrayalGame';
import { createMockCanvasContext } from '../../../utils/__tests__/testUtils';
import { FPS, STEP_MS, describePlayability, holdKeys, playMany, report, withSeed, type RunResult } from './harness';

type Vec = { x: number; y: number };
type Body = { position: Vec; velocity: Vec; size: number };
type Phase = 'intro' | 'battle' | 'escape' | 'final' | 'victory' | 'defeat';

/** Only what a player can see on screen (or in the HUD). */
type BetrayalView = {
  player: Body & { rotation: number; health: number; shield: number };
  aiBoss: Body & { health: number; maxHealth: number; laserChargeTimer: number; laserAngle: number };
  bullets: (Body & { isPlayerBullet: boolean; damage: number })[];
  minions: (Body & { alive: boolean })[];
  glitches: (Omit<Body, 'velocity'> & { type: 'powerup' | 'damage' })[];
  gamePhase: Phase;
  /** Game-side damage ledger; read by the observer only, never by the bots. */
  damageTaken: Record<'bullet' | 'laser' | 'contact' | 'minion' | 'glitch', number>;
};

const view = (game: BetrayalGame) => game as unknown as BetrayalView;

const REACTION_FRAMES = 12;
const ROTATION_SPEED = 0.06;
const THRUST = 0.18;
const PLAYER_BULLET_SPEED = 7.2;
const LASER_FIRE_FRAMES = 150;
const ATTENTION_SPAN = 8;
const IN_BATTLE: Phase[] = ['battle', 'escape', 'final'];

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

interface Threat { x: number; y: number; vx: number; vy: number; r: number; weight: number }
interface Snapshot {
  threats: Threat[];
  minions: { x: number; y: number; vx: number; vy: number }[];
  glitches: { x: number; y: number; r: number; type: 'powerup' | 'damage' }[];
  boss: { x: number; y: number; vx: number; vy: number; r: number };
  laser: { charging: boolean; firing: boolean; angle: number };
}

function snapshot(v: BetrayalView): Snapshot {
  const b = v.aiBoss;
  return {
    threats: v.bullets.filter(s => !s.isPlayerBullet).map(s => ({
      x: s.position.x, y: s.position.y, vx: s.velocity.x, vy: s.velocity.y, r: s.size, weight: s.damage,
    })),
    minions: v.minions.filter(m => m.alive).map(m => ({ x: m.position.x, y: m.position.y, vx: m.velocity.x, vy: m.velocity.y })),
    glitches: v.glitches.map(g => ({ x: g.position.x, y: g.position.y, r: g.size, type: g.type })),
    boss: { x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y, r: b.size },
    laser: {
      charging: b.laserChargeTimer > 0,
      firing: b.laserChargeTimer < 0 && b.laserChargeTimer > -LASER_FIRE_FRAMES,
      angle: b.laserAngle,
    },
  };
}

/** Distance from p to the ray starting at o in direction angle (the beam as drawn). */
function rayDistance(px: number, py: number, ox: number, oy: number, angle: number) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const t = Math.max(0, (px - ox) * dx + (py - oy) * dy);
  return Math.hypot(px - (ox + dx * t), py - (oy + dy * t));
}

const HEADINGS = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);
const LOOKAHEAD = [6, 12, 18, 24, 32, 40, 50];

/**
 * Human-like pilot. Sees the arena as it was ~0.2 s ago (new bullets and the laser
 * telegraph register late), extrapolates what it saw, misjudges positions slightly,
 * aims with a per-decision angular error, and has occasional attention lapses.
 * Each decision it picks the escape heading that looks safest over the next
 * ~0.8 s, turning and thrusting the way a keyboard player would.
 */
function humanLikeBot() {
  const history: Snapshot[] = [];
  let aimError = 0;
  let judgeNoise = 0;
  let nextDecision = 0;
  let lapseUntil = -1;
  let moveHeading: number | null = null;
  let targetMinion = -1;

  return (game: BetrayalGame, frame: number, rng: () => number) => {
    const v = view(game);
    if (!IN_BATTLE.includes(v.gamePhase)) { holdKeys(game, []); history.length = 0; return; }
    history.push(snapshot(v));
    if (history.length > REACTION_FRAMES + 1) history.shift();
    const seen = history[0];
    const lag = history.length - 1;

    if (frame < lapseUntil) { holdKeys(game, []); return; }
    if (rng() < 0.0015) { lapseUntil = frame + 20 + Math.floor(rng() * 20); holdKeys(game, []); return; }

    const ship = v.player;
    const px = ship.position.x, py = ship.position.y;
    const pvx = ship.velocity.x, pvy = ship.velocity.y;
    const speed = Math.hypot(pvx, pvy);
    const W = 1000, H = 700;

    // A player can only track a handful of bullets at once: the nearest few
    const threats = seen.threats
      .map(t => ({ ...t, x: t.x + t.vx * lag, y: t.y + t.vy * lag }))
      .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
      .slice(0, ATTENTION_SPAN);
    const boss = { ...seen.boss, x: seen.boss.x + seen.boss.vx * lag, y: seen.boss.y + seen.boss.vy * lag };
    const minions = seen.minions.map(m => ({ ...m, x: m.x + m.vx * lag, y: m.y + m.vy * lag }));
    const laserDanger = seen.laser.charging || seen.laser.firing;

    if (frame >= nextDecision) {
      nextDecision = frame + 6 + Math.floor(rng() * 6);
      aimError = (rng() * 2 - 1) * 0.1;
      judgeNoise = 6 + rng() * 8;

      // Score each option: keep coasting/braking, or turn and burn toward one of 12 headings
      const options: (number | null)[] = [null, ...HEADINGS];
      let bestCost = Infinity;
      let best: number | null = null;
      for (const heading of options) {
        const turnFrames = heading === null ? 0 : Math.abs(wrapAngle(heading - ship.rotation)) / ROTATION_SPEED;
        let cost = 0;
        for (const t of LOOKAHEAD) {
          let x = px + pvx * t, y = py + pvy * t;
          if (heading !== null) {
            const burn = Math.max(0, t - turnFrames * 0.6);
            const d = 0.5 * THRUST * 0.85 * burn * burn;
            x += Math.cos(heading) * d;
            y += Math.sin(heading) * d;
          }
          x = Math.max(20, Math.min(W - 20, x));
          y = Math.max(20, Math.min(H - 20, y));
          const near = 1.4 - t / 60;
          for (const b of threats) {
            const d = Math.hypot(b.x + b.vx * t - x, b.y + b.vy * t - y);
            const reach = (20 + b.r) / 2 + judgeNoise;
            if (d < reach) cost += b.weight * near;
          }
          for (const m of minions) {
            if (Math.hypot(m.x + m.vx * t - x, m.y + m.vy * t - y) < 40) cost += 6 * near;
          }
          for (const g of seen.glitches) {
            if (g.type === 'damage' && Math.hypot(g.x - x, g.y - y) < (20 + g.r) / 2 + 8) cost += 8 * near;
          }
          const bossD = Math.hypot(boss.x + boss.vx * t - x, boss.y + boss.vy * t - y);
          if (bossD < (20 + boss.r) / 2 + 40) cost += 25 * near;
          if (laserDanger && rayDistance(x, y, boss.x, boss.y, seen.laser.angle) < 50) cost += 40 * near;
          if (x < 50 || x > W - 50 || y < 50 || y > H - 50) cost += 1;
          // Preferred fighting range: close enough to hit, far enough to read bullets
          if (bossD < 220) cost += 0.4;
          else if (bossD > 420) cost += 0.2;
        }
        if (heading !== null) cost += 0.3;
        if (cost < bestCost - 0.5 || (heading === null && cost <= bestCost)) { bestCost = cost; best = heading; }
      }
      moveHeading = best;

      // Shoot minions that come close, otherwise the boss
      targetMinion = -1;
      let bestD = 180;
      minions.forEach((m, i) => {
        const d = Math.hypot(m.x - px, m.y - py);
        if (d < bestD) { bestD = d; targetMinion = i; }
      });
    }

    const keys: string[] = [];
    if (moveHeading !== null) {
      const diff = wrapAngle(moveHeading - ship.rotation);
      if (diff > 0.12) keys.push('KeyD');
      else if (diff < -0.12) keys.push('KeyA');
      if (Math.abs(diff) < 0.7 && speed < 4.5) keys.push('KeyW');
    } else {
      const tgt = minions[targetMinion] ?? boss;
      const dx = tgt.x - px, dy = tgt.y - py;
      const dist = Math.hypot(dx, dy);
      const lead = dist / PLAYER_BULLET_SPEED;
      const aim = Math.atan2(dy + tgt.vy * lead, dx + tgt.vx * lead) + aimError;
      const diff = wrapAngle(aim - ship.rotation);
      if (diff > 0.05) keys.push('KeyD');
      else if (diff < -0.05) keys.push('KeyA');
      if (speed > 1.5) keys.push('KeyS');
    }
    // Fire whenever the nose is roughly on target (players hold fire a lot)
    const tgt = minions[targetMinion] ?? boss;
    const aimNow = Math.atan2(tgt.y - py, tgt.x - px);
    if (Math.abs(wrapAngle(aimNow + aimError - ship.rotation)) < 0.18) keys.push('Space');
    holdKeys(game, keys);
  };
}

const idleBot = (game: BetrayalGame) => holdKeys(game, []);

function makeMetrics(): Record<string, number> {
  return {
    introSec: NaN,
    battleSec: NaN,
    escapeSec: NaN,
    finalSec: NaN,
    firstDamageSec: Infinity,
    damagedWithin5s: 0,
    lostWithin20s: 0,
    dmgBullets: 0,
    dmgLaser: 0,
    dmgContact: 0,
    dmgMinion: 0,
    dmgGlitch: 0,
    dmgInBattle: 0,
    dmgInEscape: 0,
    dmgInFinal: 0,
    winHpLeft: NaN,
    lasersFired: 0,
    laserHitFrames: 0,
    longestQuietGapSec: 0,
    reachedFinal: 0,
    lostInPhase: 0,
  };
}

const DAMAGE_METRIC: Record<keyof BetrayalView['damageTaken'], string> = {
  bullet: 'dmgBullets', laser: 'dmgLaser', contact: 'dmgContact', minion: 'dmgMinion', glitch: 'dmgGlitch',
};

/**
 * Records fairness / pacing metrics. Times are measured from the end of the intro,
 * when the player first gets control. Damage by source comes from the game's own ledger.
 */
function observer(metrics: Record<string, number>) {
  let phase: Phase = 'intro';
  let phaseStart = 0;
  let battleStart: number | null = null;
  let lastEvent = 0;
  let bossHp = Infinity;
  let hp = Infinity;
  let laserDamage = 0;
  let prevLaserFiring = false;

  return (game: BetrayalGame, frame: number) => {
    const v = view(game);
    if (v.gamePhase !== phase) {
      const dur = (frame - phaseStart) / FPS;
      if (phase === 'intro') metrics.introSec = dur;
      if (phase === 'battle') metrics.battleSec = dur;
      if (phase === 'escape') metrics.escapeSec = dur;
      if (phase === 'final') metrics.finalSec = dur;
      if (v.gamePhase === 'final') metrics.reachedFinal = 1;
      if (v.gamePhase === 'defeat') metrics.lostInPhase = IN_BATTLE.indexOf(phase) + 1;
      if (battleStart === null) battleStart = frame;
      lastEvent = frame;
      phaseStart = frame;
      phase = v.gamePhase;
    }
    if (battleStart === null) return;
    const sinceBattle = (frame - battleStart) / FPS;

    for (const [source, key] of Object.entries(DAMAGE_METRIC)) {
      metrics[key] = v.damageTaken[source as keyof typeof DAMAGE_METRIC];
    }
    if (v.damageTaken.laser > laserDamage) metrics.laserHitFrames++;
    laserDamage = v.damageTaken.laser;
    const firing = v.aiBoss.laserChargeTimer < 0 && v.aiBoss.laserChargeTimer > -LASER_FIRE_FRAMES;
    if (firing && !prevLaserFiring) metrics.lasersFired++;
    prevLaserFiring = firing;

    if (v.aiBoss.health < bossHp) lastEvent = frame;
    bossHp = v.aiBoss.health;

    const nowHp = v.player.health + v.player.shield;
    const loss = Number.isFinite(hp) ? hp - nowHp : 0;
    hp = nowHp;
    if (loss > 0.2) {
      lastEvent = frame;
      const phaseKey = phase === 'escape' ? 'dmgInEscape' : phase === 'final' ? 'dmgInFinal' : 'dmgInBattle';
      metrics[phaseKey] += loss;
      if (!Number.isFinite(metrics.firstDamageSec)) metrics.firstDamageSec = sinceBattle;
      if (sinceBattle <= 5) metrics.damagedWithin5s = 1;
    }
    if (phase === 'victory') metrics.winHpLeft = Math.max(0, v.player.health) + Math.max(0, v.player.shield);
    if (phase === 'defeat' && sinceBattle <= 20) metrics.lostWithin20s = 1;
    if (IN_BATTLE.includes(phase)) {
      metrics.longestQuietGapSec = Math.max(metrics.longestQuietGapSec, (frame - lastEvent) / FPS);
    }
  };
}

type Bot = (game: BetrayalGame, frame: number, rng: () => number) => void;

/** playMany calls makeMetrics right before each session, so a fresh bot and probe are built there. */
async function run(makeBot: () => Bot, count: number, maxSeconds: number) {
  let bot: Bot = makeBot();
  let observe: ((game: BetrayalGame, frame: number) => void) | null = null;
  return playMany(BetrayalGame, count, {
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

function sum(results: RunResult[], key: string) {
  return Math.round(results.reduce((s, r) => s + (r.metrics[key] || 0), 0));
}

const MAX_SECONDS = 900;
/** BETRAYAL_RUNS=10 gives a quicker (noisier) read while tuning. */
const HUMAN_RUNS = Number(process.env.BETRAYAL_RUNS) || 60;
const IDLE_RUNS = Number(process.env.BETRAYAL_RUNS) || 40;

describePlayability('Betrayal playability', () => {
  test('human-like pilot: hard but fair, winnable, and finishes in a few minutes', async () => {
    const { summary, results } = await run(humanLikeBot, HUMAN_RUNS, MAX_SECONDS);
    report('Betrayal / human-like', summary);
    const earlyLoss = rate(results, r => r.metrics.damagedWithin5s > 0 || r.metrics.lostWithin20s > 0);
    const damage = Object.values(DAMAGE_METRIC).map(k => `${k}=${sum(results, k)}`).join(' ');
    // Outcome, seconds, and for losses the combat phase it happened in (1 battle, 2 escape, 3 final)
    const outcomes = results.map(r => `${r.outcome[0]}${Math.round(r.seconds)}${r.metrics.lostInPhase ? `:P${r.metrics.lostInPhase}` : ''}`).join(' ');
    console.info(`[playability] Betrayal early-loss rate ${earlyLoss}; reachedFinal ${rate(results, r => r.metrics.reachedFinal > 0)}\n` +
      `total damage ${damage}\noutcomes ${outcomes}`);

    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.timeoutRate).toBeLessThanOrEqual(0.03);
    expect(summary.winRate).toBeGreaterThanOrEqual(0.4);
    expect(summary.winRate).toBeLessThanOrEqual(0.65);
    expect(summary.medianSeconds).toBeGreaterThanOrEqual(120);
    expect(summary.medianSeconds).toBeLessThanOrEqual(480);
    expect(earlyLoss).toBeLessThanOrEqual(0.02);
  }, 1_800_000);

  test('idle pilot never wins', async () => {
    const { summary } = await run(() => idleBot, IDLE_RUNS, MAX_SECONDS);
    report('Betrayal / idle', summary);
    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.winRate).toBeLessThanOrEqual(0.05);
  }, 1_800_000);
});

type Internals = BetrayalView & {
  aiBoss: { attackTimer: number; isEscaping: boolean };
  getHudStats: BetrayalGame['getHudStats'];
};
const internals = (game: BetrayalGame) => game as unknown as Internals;

function newGame() {
  const game = new BetrayalGame(createMockCanvasContext() as CanvasRenderingContext2D, 1000, 700);
  game.init();
  return game;
}

/** Jumps straight to a combat phase with the boss's own attack timer parked. */
function enterPhase(game: BetrayalGame, phase: 'battle' | 'escape' | 'final') {
  const g = internals(game);
  g.gamePhase = phase;
  g.aiBoss.isEscaping = phase !== 'battle';
  g.aiBoss.attackTimer = 1e9;
  g.aiBoss.position = { x: 500, y: 150 };
  g.aiBoss.velocity = { x: 0, y: 0 };
}

function step(game: BetrayalGame, frames: number, each?: () => void) {
  for (let i = 0; i < frames; i++) { game.update(STEP_MS); each?.(); }
}

const laserStat = (game: BetrayalGame) => game.getHudStats().find(s => s.label === 'Laser')?.value;

describe('Betrayal mechanics', () => {
  test('laser telegraphs, fires, then ends; it hits along its beam only', () => withSeed(7, async () => {
    for (const [offsetX, offsetY, expectHit] of [[0, 450, true], [40, 450, false], [0, -90, false]] as const) {
      const game = newGame();
      enterPhase(game, 'final');
      const g = internals(game);
      g.player.position = { x: 500 + offsetX, y: 150 + offsetY };
      g.aiBoss.laserAngle = Math.PI / 2;
      g.aiBoss.laserChargeTimer = 150;

      let chargeFrames = 0, fireFrames = 0, damageWhileCharging = 0;
      const phases: string[] = [];
      step(game, 400, () => {
        const t = g.aiBoss.laserChargeTimer;
        const label = t > 0 ? 'charge' : t < 0 && t > -LASER_FIRE_FRAMES ? 'fire' : 'done';
        if (phases[phases.length - 1] !== label) phases.push(label);
        expect(laserStat(game)).toBe(label === 'charge' ? 'CHARGING' : label === 'fire' ? 'FIRING' : undefined);
        if (label === 'charge') { chargeFrames++; damageWhileCharging = g.damageTaken.laser; }
        if (label === 'fire') fireFrames++;
      });

      expect(phases).toEqual(['charge', 'fire', 'done']);
      expect(chargeFrames).toBeGreaterThanOrEqual(120); // >= 2 s to read the telegraph and move
      expect(fireFrames).toBe(LASER_FIRE_FRAMES - 1);
      expect(damageWhileCharging).toBe(0);
      if (expectHit) {
        // Standing in the beam for its whole duration hurts a lot, but full HP + shield survives it
        expect(g.damageTaken.laser).toBeGreaterThan(60);
        expect(g.player.health).toBeGreaterThan(0);
      } else {
        expect(g.damageTaken.laser).toBe(0);
      }
    }
  }));

  test('defeat in any combat phase fires onGameOver exactly once, after the transition', () => withSeed(7, async () => {
    for (const phase of ['battle', 'escape', 'final'] as const) {
      const game = newGame();
      let over = 0, complete = 0;
      game.onGameOver = () => over++;
      game.onStageComplete = () => complete++;
      enterPhase(game, phase);
      internals(game).player.health = 0;
      step(game, 1);
      expect(internals(game).gamePhase).toBe('defeat');
      expect(over).toBe(0);
      step(game, 300);
      expect([over, complete]).toEqual([1, 0]);
    }
  }));

  test('victory only comes from the final form, and fires onStageComplete exactly once', () => withSeed(7, async () => {
    const game = newGame();
    let over = 0, complete = 0;
    game.onGameOver = () => over++;
    game.onStageComplete = () => complete++;

    // Shots pass through the boss while it is phased out escaping
    enterPhase(game, 'escape');
    const g = internals(game);
    const before = g.aiBoss.health;
    g.bullets.push({ position: { ...g.aiBoss.position }, velocity: { x: 0, y: 0 }, size: 4, isPlayerBullet: true, damage: 25 });
    step(game, 1);
    expect(g.aiBoss.health).toBe(before);

    enterPhase(game, 'final');
    g.aiBoss.health = 0;
    step(game, 300);
    expect(g.gamePhase).toBe('victory');
    expect([over, complete]).toEqual([0, 1]);
  }));

  test('the boss stays inside the arena while hunting the player', () => withSeed(7, async () => {
    const game = newGame();
    enterPhase(game, 'battle');
    const g = internals(game);
    g.aiBoss.attackTimer = 0;
    g.player.health = 1e9;
    step(game, 3 * 60 * FPS, () => {
      expect(g.aiBoss.position.x).toBeGreaterThanOrEqual(0);
      expect(g.aiBoss.position.x).toBeLessThanOrEqual(1000);
      expect(g.aiBoss.position.y).toBeGreaterThanOrEqual(0);
      expect(g.aiBoss.position.y).toBeLessThanOrEqual(700);
    });
  }));

  test('a tap fires toward the tapped point; Space skips intro lines', () => withSeed(7, async () => {
    const game = newGame();
    step(game, 60);
    game.handleInput({ code: 'Space', repeat: false } as KeyboardEvent);
    expect(game.getHudStats().find(s => s.label === 'Phase')?.value).toBe('INTRO');
    expect((game as unknown as { messageIndex: number }).messageIndex).toBe(1);

    enterPhase(game, 'battle');
    const g = internals(game);
    g.player.position = { x: 500, y: 600 };
    game.handlePointerDown(800, 600);
    const shot = g.bullets.find(b => b.isPlayerBullet);
    expect(shot?.velocity.x).toBeGreaterThan(0);
    expect(Math.abs(shot?.velocity.y ?? 1)).toBeLessThan(1e-9);
  }));
});
