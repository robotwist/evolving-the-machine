import { BaseGame, type HudStat } from './BaseGame';
import { isAudioMuted } from './engine/audio';

interface Dancer {
  x: number;
  y: number;
  angle: number;
  hatTilt: number;
  caneAngle: number;
  legPhase: number;
  armPhase: number;
  stepPhase: number;
  isLeaping: boolean;
  leapHeight: number;
}

interface RhythmTarget {
  x: number;
  y: number;
  time: number; // in frames
  duration: number;
  hit: boolean;
  missed: boolean;
  active: boolean;
  hitAt: number;
}

interface DanceSequence {
  name: string;
  start: number; // in frames
  duration: number; // in frames
  targetEveryBeats: number; // 0 = no rhythm targets
}

const DANCE_DURATION_FRAMES = 10800; // 3 minutes at 60fps
const BEAT_FRAMES = 30; // 120 BPM grid; every sequence and target lands on a beat

// Lengths in beats; CURTAIN_CALL takes whatever remains of the 3 minutes.
const SEQUENCE_PLAN: Array<{ name: string; beats: number; targetEveryBeats: number }> = [
  { name: 'CURTAIN_RISE', beats: 10, targetEveryBeats: 0 },
  { name: 'OPENING_BOW', beats: 16, targetEveryBeats: 4 },
  { name: 'TOP_HAT_TRICKS', beats: 32, targetEveryBeats: 4 },
  { name: 'CANE_TWIRLING', beats: 40, targetEveryBeats: 4 },
  { name: 'TAP_DANCE_ROUTINE', beats: 64, targetEveryBeats: 2 },
  { name: 'HIGH_KICKS', beats: 32, targetEveryBeats: 4 },
  { name: 'CHARLESTON_MOVES', beats: 48, targetEveryBeats: 4 },
  { name: 'CANE_BALANCE', beats: 32, targetEveryBeats: 4 },
  { name: 'SPIN_SPECTACULAR', beats: 40, targetEveryBeats: 4 },
  { name: 'FINAL_BOW', beats: 24, targetEveryBeats: 4 },
  { name: 'CURTAIN_CALL', beats: 0, targetEveryBeats: 0 },
];

function buildSequences(): DanceSequence[] {
  let start = 0;
  return SEQUENCE_PLAN.map((plan, i) => {
    const isLast = i === SEQUENCE_PLAN.length - 1;
    const duration = isLast ? DANCE_DURATION_FRAMES - start : plan.beats * BEAT_FRAMES;
    const seq = { name: plan.name, start, duration, targetEveryBeats: plan.targetEveryBeats };
    start += duration;
    return seq;
  });
}

// A target lives for 4 beats, shrinking from TARGET_START_RADIUS to TARGET_END_RADIUS.
const TARGET_LIFETIME_FRAMES = 4 * BEAT_FRAMES;
const TARGET_START_RADIUS = 50;
const TARGET_END_RADIUS = 20;
// Fading targets stay visible: they remain hittable until they expire.
const TARGET_MIN_ALPHA = 0.35;
const TARGET_AREA = { minX: 0.2, maxX: 0.8, minY: 0.3, maxY: 0.7 };
// Keeps a new target clear of the ones still on screen so taps are unambiguous.
const MIN_TARGET_SPACING_PX = 140;
const TARGET_PLACEMENT_ATTEMPTS = 12;
const HIT_FLASH_FRAMES = 20;

// Points per hit = HIT_POINTS × min(combo, MAX_COMBO_MULTIPLIER). A perfect run must stay
// under the score store's 20,000 anti-cheat ceiling for this stage (98 targets → 19,300).
const HIT_POINTS = 50;
const MAX_COMBO_MULTIPLIER = 4;

export class DanceInterlude extends BaseGame {
  private dancer!: Dancer;
  private danceTimer = 0;
  private readonly DANCE_DURATION = DANCE_DURATION_FRAMES;
  private stageLights: Array<{x: number, y: number, intensity: number, color: string}> = [];
  private curtains = 0;
  private applauseTimer = 0;
  private musicStarted = false;
  private danceMusic: HTMLAudioElement | null = null;
  private score = 0;
  private combo = 0;
  private playerPerformance = 1.0; // 0.0 (bad) to 1.0 (perfect)
  private rhythmTargets: RhythmTarget[] = [];
  // Target positions are fractions of the canvas so they survive a resize
  private beatMap: Array<{time: number, fx: number, fy: number}> = [];
  private nextBeatIndex = 0;
  private completed = false;
  private skipRequested = false;

  // Dance sequence breakdown
  private readonly sequences = buildSequences();

  init() {
    // Initialize AI dancer (humanoid bot)
    this.dancer = {
      x: this.width / 2,
      y: this.height - 150,
      angle: 0,
      hatTilt: 0,
      caneAngle: 0,
      legPhase: 0,
      armPhase: 0,
      stepPhase: 0,
      isLeaping: false,
      leapHeight: 0
    };

    // Initialize stage lights
    this.initializeStageLights();
    this.curtains = this.height; // Start with curtains down
    this.createBeatMap();
  }

  private createBeatMap() {
    // Correlate beats with dance sequences
    this.beatMap = [];
    this.nextBeatIndex = 0;
    this.sequences.forEach(seq => {
        if (seq.targetEveryBeats <= 0) return;

        const interval = seq.targetEveryBeats * BEAT_FRAMES;
        for (let time = seq.start; time < seq.start + seq.duration; time += interval) {
            this.beatMap.push({ time, ...this.pickTargetPosition(time) });
        }
    });
  }

  /** Random spot in the target area, kept apart from targets that will still be on screen. */
  private pickTargetPosition(time: number): { fx: number; fy: number } {
    const onScreen = this.beatMap.filter(beat => time - beat.time < TARGET_LIFETIME_FRAMES);
    let best = { fx: 0.5, fy: 0.5 };
    let bestClearance = -1;
    for (let attempt = 0; attempt < TARGET_PLACEMENT_ATTEMPTS; attempt++) {
      const fx = TARGET_AREA.minX + Math.random() * (TARGET_AREA.maxX - TARGET_AREA.minX);
      const fy = TARGET_AREA.minY + Math.random() * (TARGET_AREA.maxY - TARGET_AREA.minY);
      const clearance = Math.min(Infinity, ...onScreen.map(beat =>
        Math.hypot((fx - beat.fx) * this.width, (fy - beat.fy) * this.height)
      ));
      if (clearance > bestClearance) {
        best = { fx, fy };
        bestClearance = clearance;
      }
      if (clearance >= MIN_TARGET_SPACING_PX) break;
    }
    return best;
  }

  private initializeStageLights() {
    // Spotlight configuration
    this.stageLights = [
      { x: this.width * 0.3, y: 50, intensity: 0.8, color: '#FFD700' },
      { x: this.width * 0.5, y: 30, intensity: 1.0, color: '#FFFFFF' },
      { x: this.width * 0.7, y: 50, intensity: 0.8, color: '#FF69B4' }
    ];
  }

  update(_deltaTime: number) {
    if (this.completed) return;
    if (this.skipRequested) {
      this.finishDance();
      return;
    }
    this.reportScore(this.score);
    this.danceTimer++;

    // Start music on first frame
    if (!this.musicStarted) {
      this.startDanceMusic();
      this.musicStarted = true;
    }

    // Update dance sequence
    this.updateDanceSequence();
    
    // Update dancer movements
    this.updateDancerMovements();
    
    // Update rhythm targets
    this.updateRhythmTargets();

    // Update stage effects
    this.updateStageEffects();

    // End dance after duration. This is a breather stage: it always completes, whatever the score.
    if (this.danceTimer >= this.DANCE_DURATION) {
      this.finishDance();
    }
  }

  private finishDance() {
    if (this.completed) return;
    this.completed = true;
    this.reportScore(this.score);
    this.danceMusic?.pause();
    this.onStageComplete?.();
  }

  protected cleanup() {
    super.cleanup();
    this.danceMusic?.pause();
    this.danceMusic = null;
  }

  private startDanceMusic() {
    // Play "Puttin' on the Ritz" music
    try {
      if (!isAudioMuted() && !this.danceMusic) {
        // Load and play the dance music
        this.danceMusic = new Audio('/sounds/puttin-on-the-ritz.mp3');
        this.danceMusic.loop = true;
        this.danceMusic.volume = 0.6; // Slightly lower volume for dance music
        this.danceMusic.play().catch(e => {
          console.warn('Could not play dance music:', e);
        });
      }
    } catch (error) {
      console.warn('Dance music system not available:', error);
    }
  }

  private updateDanceSequence() {
    const currentSequence = this.getCurrentSequence();
    const sequenceProgress = this.getSequenceProgress();

    // Performance affects animation quality
    const performanceFactor = 0.5 + this.playerPerformance * 0.5;

    switch (currentSequence?.name) {
      case 'CURTAIN_RISE':
        this.curtains = this.height * (1 - sequenceProgress);
        break;
      
      case 'OPENING_BOW':
        this.dancer.angle = Math.sin(sequenceProgress * Math.PI) * 0.5 * performanceFactor;
        this.dancer.hatTilt = sequenceProgress * 0.3 * performanceFactor;
        break;
      
      case 'TOP_HAT_TRICKS':
        this.updateTopHatTricks(sequenceProgress);
        break;
      
      case 'CANE_TWIRLING':
        this.updateCaneTwirling(sequenceProgress);
        break;
      
      case 'TAP_DANCE_ROUTINE':
        this.updateTapDance(sequenceProgress);
        break;
      
      case 'HIGH_KICKS':
        this.updateHighKicks(sequenceProgress);
        break;
      
      case 'CHARLESTON_MOVES':
        this.updateCharlestonMoves(sequenceProgress);
        break;
      
      case 'CANE_BALANCE':
        this.updateCaneBalance(sequenceProgress);
        break;
      
      case 'SPIN_SPECTACULAR':
        this.updateSpinSpectacular(sequenceProgress);
        break;
      
      case 'FINAL_BOW':
        this.updateFinalBow(sequenceProgress);
        break;
      
      case 'CURTAIN_CALL':
        this.curtains = this.height * sequenceProgress;
        this.applauseTimer = 60;
        break;
    }
  }

  private getCurrentSequence() {
    return this.sequences.find(seq => 
      this.danceTimer >= seq.start && this.danceTimer < seq.start + seq.duration
    );
  }

  private getSequenceProgress() {
    const currentSeq = this.getCurrentSequence();
    if (!currentSeq) return 0;
    return (this.danceTimer - currentSeq.start) / currentSeq.duration;
  }

  private updateTopHatTricks(progress: number) {
    // Hat tipping and juggling motions
    this.dancer.hatTilt = Math.sin(progress * Math.PI * 8) * 0.4;
    this.dancer.armPhase = progress * Math.PI * 4;
    
    // Occasional hat tip
    if (Math.floor(progress * 8) % 2 === 0) {
      this.dancer.hatTilt += 0.2;
    }
  }

  private updateCaneTwirling(progress: number) {
    // Spectacular cane twirling
    this.dancer.caneAngle = progress * Math.PI * 12; // Multiple rotations
    this.dancer.armPhase = Math.sin(progress * Math.PI * 6) * 0.3;
    
    // Side to side movement while twirling
    this.dancer.x = this.width / 2 + Math.sin(progress * Math.PI * 2) * 80;
  }

  private updateTapDance(progress: number) {
    // Rapid tap dancing feet
    this.dancer.stepPhase = progress * Math.PI * 16;
    this.dancer.legPhase = Math.sin(this.dancer.stepPhase) * 0.4;
    
    // Quick side movements
    this.dancer.x = this.width / 2 + Math.sin(progress * Math.PI * 8) * 40;
    
    // Rhythmic body movement
    this.dancer.y = this.height - 150 + Math.abs(Math.sin(this.dancer.stepPhase)) * 10;
  }

  private updateHighKicks(progress: number) {
    // Classic chorus line high kicks
    this.dancer.legPhase = Math.sin(progress * Math.PI * 6) * 1.2;
    this.dancer.armPhase = -this.dancer.legPhase * 0.5;
    
    // Balance on one foot during kicks
    if (Math.abs(this.dancer.legPhase) > 0.8) {
      this.dancer.y = this.height - 140; // Slight hop
    } else {
      this.dancer.y = this.height - 150;
    }
  }

  private updateCharlestonMoves(progress: number) {
    // 1920s Charleston dance
    this.dancer.armPhase = Math.sin(progress * Math.PI * 6) * 0.6;
    this.dancer.legPhase = Math.cos(progress * Math.PI * 6) * 0.4;
    
    // Characteristic Charleston knee movements
    const kneePhase = Math.sin(progress * Math.PI * 8);
    this.dancer.x = this.width / 2 + kneePhase * 30;
    
    // Swinging arms across body
    this.dancer.angle = kneePhase * 0.2;
  }

  private updateCaneBalance(progress: number) {
    // Balancing cane on nose/hand
    this.dancer.caneAngle = Math.PI / 2 + Math.sin(progress * Math.PI * 4) * 0.1;
    this.dancer.hatTilt = -0.1; // Focus pose
    
    // Careful balancing movement
    this.dancer.x = this.width / 2 + Math.sin(progress * Math.PI * 2) * 15;
    this.dancer.armPhase = 0.2; // Arms out for balance
  }

  private updateSpinSpectacular(progress: number) {
    // Multiple spins with cane extended
    this.dancer.angle = progress * Math.PI * 8; // 4 full rotations
    this.dancer.caneAngle = this.dancer.angle * 2;
    
    // Expanding spiral movement
    const radius = 60 * Math.sin(progress * Math.PI);
    this.dancer.x = this.width / 2 + Math.cos(this.dancer.angle) * radius;
    this.dancer.y = this.height - 150 + Math.sin(this.dancer.angle) * 10;
  }

  private updateFinalBow(progress: number) {
    // Deep theatrical bow
    const performanceFactor = 0.5 + this.playerPerformance * 0.5;
    this.dancer.angle = Math.sin(progress * Math.PI) * 0.8 * performanceFactor;
    this.dancer.hatTilt = progress * 0.5 * performanceFactor;
    this.dancer.caneAngle = progress * 0.3 * performanceFactor;
    
    // Arms sweeping bow gesture
    this.dancer.armPhase = progress * 0.4 * performanceFactor;
  }

  private updateDancerMovements() {
    // Update leap physics
    if (this.dancer.isLeaping) {
      this.dancer.leapHeight = Math.sin(this.dancer.stepPhase) * 20 * this.playerPerformance;
    }
    
    // Keep dancer on stage
    this.dancer.x = Math.max(100, Math.min(this.width - 100, this.dancer.x));
  }

  private updateRhythmTargets() {
    // Spawn targets from beatmap
    while (this.nextBeatIndex < this.beatMap.length && this.beatMap[this.nextBeatIndex].time <= this.danceTimer) {
        const beat = this.beatMap[this.nextBeatIndex++];
        this.rhythmTargets.push({
            x: this.width * beat.fx,
            y: this.height * beat.fy,
            time: this.danceTimer,
            duration: TARGET_LIFETIME_FRAMES,
            hit: false,
            missed: false,
            active: true,
            hitAt: -1
        });
    }

    // Update existing targets
    for (let i = this.rhythmTargets.length - 1; i >= 0; i--) {
        const target = this.rhythmTargets[i];
        if (!target.active) continue;

        const age = this.danceTimer - target.time;
        if (age >= target.duration) {
            target.missed = true;
            target.active = false;
            this.combo = 0;
            this.playerPerformance = Math.max(0, this.playerPerformance - 0.1);
        }
    }
  }

  private updateStageEffects() {
    // Pulsing stage lights with music
    this.stageLights.forEach((light, index) => {
      light.intensity = 0.7 + Math.sin(this.danceTimer * 0.1 + index) * 0.3;
    });
    
    // Applause timer
    if (this.applauseTimer > 0) {
      this.applauseTimer--;
    }
  }

  render() {
    this.clearCanvas();
    
    // Draw theater background
    this.drawTheaterBackground();
    
    // Draw stage lights
    this.drawStageLights();
    
    // Draw the dancing AI humanoid
    this.drawDancer();
    
    // Draw rhythm targets
    this.drawRhythmTargets();

    // Draw curtains
    this.drawCurtains();
    
    // Draw dance info
    this.drawDanceInfo();
  }

  private drawTheaterBackground() {
    // Theater stage gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.7, '#2d1b69');
    gradient.addColorStop(1, '#8b0000');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Stage floor
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(0, this.height - 100, this.width, 100);
    
    // Stage floor pattern
    this.ctx.strokeStyle = '#654321';
    this.ctx.lineWidth = 2;
    for (let i = 0; i < this.width; i += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(i, this.height - 100);
      this.ctx.lineTo(i, this.height);
      this.ctx.stroke();
    }
  }

  private drawStageLights() {
    this.stageLights.forEach(light => {
      const gradient = this.ctx.createRadialGradient(
        light.x, light.y, 0,
        light.x, light.y, 200 * light.intensity
      );
      gradient.addColorStop(0, `${light.color}40`);
      gradient.addColorStop(1, `${light.color}00`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.width, this.height);
    });
  }

  private drawDancer() {
    this.ctx.save();
    this.ctx.translate(this.dancer.x, this.dancer.y - this.dancer.leapHeight);
    this.ctx.rotate(this.dancer.angle);
    
    // Draw humanoid AI bot body
    this.drawDancerBody();
    this.drawTopHat();
    this.drawCane();
    
    this.ctx.restore();
  }

  private drawDancerBody() {
    // Main body (rectangular robot torso)
    this.ctx.fillStyle = '#C0C0C0';
    this.ctx.strokeStyle = '#808080';
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(-15, -40, 30, 50);
    this.ctx.strokeRect(-15, -40, 30, 50);
    
    // Robot head
    this.ctx.fillRect(-10, -60, 20, 20);
    this.ctx.strokeRect(-10, -60, 20, 20);
    
    // Glowing AI eyes
    this.ctx.fillStyle = '#00FFFF';
    this.ctx.fillRect(-8, -55, 4, 4);
    this.ctx.fillRect(4, -55, 4, 4);
    
    // Arms (dancing position)
    const leftArmX = -15 + Math.cos(this.dancer.armPhase) * 20;
    const leftArmY = -20 + Math.sin(this.dancer.armPhase) * 15;
    const rightArmX = 15 + Math.cos(this.dancer.armPhase + Math.PI) * 20;
    const rightArmY = -20 + Math.sin(this.dancer.armPhase + Math.PI) * 15;
    
    this.ctx.strokeStyle = '#808080';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(-15, -20);
    this.ctx.lineTo(leftArmX, leftArmY);
    this.ctx.moveTo(15, -20);
    this.ctx.lineTo(rightArmX, rightArmY);
    this.ctx.stroke();
    
    // Legs (dancing position)
    const leftLegX = -8 + Math.cos(this.dancer.legPhase) * 15;
    const leftLegY = 30 + Math.sin(this.dancer.legPhase) * 10;
    const rightLegX = 8 + Math.cos(this.dancer.legPhase + Math.PI) * 15;
    const rightLegY = 30 + Math.sin(this.dancer.legPhase + Math.PI) * 10;
    
    this.ctx.beginPath();
    this.ctx.moveTo(-8, 10);
    this.ctx.lineTo(leftLegX, leftLegY);
    this.ctx.moveTo(8, 10);
    this.ctx.lineTo(rightLegX, rightLegY);
    this.ctx.stroke();
    
    // Dancing feet
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(leftLegX - 5, leftLegY, 10, 3);
    this.ctx.fillRect(rightLegX - 5, rightLegY, 10, 3);
  }

  private drawTopHat() {
    this.ctx.save();
    this.ctx.rotate(this.dancer.hatTilt);
    
    // Top hat
    this.ctx.fillStyle = '#000000';
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 2;
    
    // Hat brim
    this.ctx.fillRect(-12, -65, 24, 3);
    this.ctx.strokeRect(-12, -65, 24, 3);
    
    // Hat top
    this.ctx.fillRect(-8, -85, 16, 20);
    this.ctx.strokeRect(-8, -85, 16, 20);
    
    // Hat band
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillRect(-8, -70, 16, 3);
    
    this.ctx.restore();
  }

  private drawCane() {
    this.ctx.save();
    this.ctx.rotate(this.dancer.caneAngle);
    
    // Cane shaft
    this.ctx.strokeStyle = '#8B4513';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(20, -10);
    this.ctx.lineTo(20, 40);
    this.ctx.stroke();
    
    // Cane handle (curved)
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(20, -10, 8, 0, Math.PI);
    this.ctx.stroke();
    
    // Cane tip
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillRect(18, 40, 4, 3);
    
    this.ctx.restore();
  }

  private drawCurtains() {
    if (this.curtains > 0) {
      // Red velvet curtains
      this.ctx.fillStyle = '#8B0000';
      this.ctx.fillRect(0, 0, this.width, this.curtains);
      
      // Curtain texture
      this.ctx.strokeStyle = '#A52A2A';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < this.width; i += 20) {
        this.ctx.beginPath();
        this.ctx.moveTo(i, 0);
        this.ctx.lineTo(i, this.curtains);
        this.ctx.stroke();
      }
    }
  }

  /** Shrinks as time runs out; the drawn circle is exactly the hit area. */
  private targetRadius(target: RhythmTarget): number {
    const progress = Math.min(1, (this.danceTimer - target.time) / target.duration);
    return TARGET_END_RADIUS + (1 - progress) * (TARGET_START_RADIUS - TARGET_END_RADIUS);
  }

  private drawRhythmTargets() {
    // Outline thickens on every beat so targets pulse with the music
    const beatPulse = 1 - (this.danceTimer % BEAT_FRAMES) / BEAT_FRAMES;

    this.rhythmTargets.forEach(target => {
        if (target.hit && this.danceTimer - target.hitAt < HIT_FLASH_FRAMES) {
          this.drawHitFlash(target);
          return;
        }
        if (!target.active) return;

        const progress = (this.danceTimer - target.time) / target.duration;
        const radius = this.targetRadius(target);
        const alpha = TARGET_MIN_ALPHA + (1 - TARGET_MIN_ALPHA) * (1 - progress);

        this.ctx.save();
        this.ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        this.ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.3})`;
        this.ctx.lineWidth = 3 + beatPulse * 2;
        this.ctx.beginPath();
        this.ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    });
  }

  private drawHitFlash(target: RhythmTarget) {
    const t = (this.danceTimer - target.hitAt) / HIT_FLASH_FRAMES;
    this.ctx.save();
    this.ctx.strokeStyle = `rgba(255, 105, 180, ${1 - t})`;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(target.x, target.y, TARGET_END_RADIUS + t * TARGET_START_RADIUS, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  getHudStats(): HudStat[] {
    return [{ label: 'Combo', value: this.combo, tone: this.combo >= 5 ? 'warning' : 'normal' }];
  }

  private drawDanceInfo() {
    const currentSeq = this.getCurrentSequence();
    const timeLeft = Math.max(0, (this.DANCE_DURATION - this.danceTimer) / 60);
    
    // Current dance move
    if (currentSeq) {
      this.drawText(
        currentSeq.name.replace(/_/g, ' '),
        this.width / 2,
        50,
        24,
        '#FFD700',
        'center'
      );
    }
    
    // Time remaining
    this.drawText(
      `♪ Puttin' on the Ritz ♪ - ${timeLeft.toFixed(1)}s remaining`,
      this.width / 2,
      80,
      16,
      '#FFFFFF',
      'center'
    );
    
    // Performance protocol
    this.drawText(
      'Performance Protocol Active',
      this.width / 2,
      this.height - 30,
      14,
      '#FFD700',
      'center'
    );
    
    // Applause effect
    if (this.applauseTimer > 0) {
      this.drawText(
        'BRAVO! ENCORE!',
        this.width / 2,
        this.height / 2,
        20,
        '#FF69B4',
        'center'
      );
    }
  }

  handleInput(event: KeyboardEvent) {
    // Allow skipping with spacebar; completes on the next update
    if (event.code === 'Space') {
      this.skipRequested = true;
    }
  }

  handlePointerDown(x: number, y: number) {
    if (this.completed) return;

    // Hit the target whose center is closest to the tap, if the tap is inside it
    let best: RhythmTarget | null = null;
    let bestDistance = Infinity;
    let anyActive = false;
    for (const target of this.rhythmTargets) {
        if (!target.active) continue;
        anyActive = true;
        const distance = Math.hypot(x - target.x, y - target.y);
        if (distance < this.targetRadius(target) && distance < bestDistance) {
            best = target;
            bestDistance = distance;
        }
    }

    if (best) {
        best.hit = true;
        best.active = false;
        best.hitAt = this.danceTimer;
        this.combo++;
        this.score += HIT_POINTS * Math.min(this.combo, MAX_COMBO_MULTIPLIER);
        this.playerPerformance = Math.min(1, this.playerPerformance + 0.05);
        this.reportScore(this.score);
        this.playHitSound();
        return;
    }

    // Missed click; taps while no target is showing are harmless
    if (!anyActive) return;
    this.combo = 0;
    this.playerPerformance = Math.max(0, this.playerPerformance - 0.02);
  }
}