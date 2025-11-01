import { BaseGame } from './BaseGame';
import { AudioState } from '@shared/types';

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
}

export class DanceInterlude extends BaseGame {
  private dancer!: Dancer;
  private danceTimer = 0;
  private sequencePhase = 0;
  private readonly DANCE_DURATION = 10800; // 3 minutes at 60fps
  private stageLights: Array<{x: number, y: number, intensity: number, color: string}> = [];
  private curtains = 0;
  private applauseTimer = 0;
  private musicStarted = false;
  private score = 0;
  private combo = 0;
  private playerPerformance = 1.0; // 0.0 (bad) to 1.0 (perfect)
  private rhythmTargets: RhythmTarget[] = [];
  private beatMap: Array<{time: number, x: number, y: number}> = [];

  // Dance sequence breakdown
  private readonly sequences = [
    { name: 'CURTAIN_RISE', duration: 300, start: 0 },
    { name: 'OPENING_BOW', duration: 240, start: 300 },
    { name: 'TOP_HAT_TRICKS', duration: 600, start: 540 },
    { name: 'CANE_TWIRLING', duration: 720, start: 1140 },
    { name: 'TAP_DANCE_ROUTINE', duration: 1200, start: 1860 },
    { name: 'HIGH_KICKS', duration: 600, start: 3060 },
    { name: 'CHARLESTON_MOVES', duration: 900, start: 3660 },
    { name: 'CANE_BALANCE', duration: 480, start: 4560 },
    { name: 'SPIN_SPECTACULAR', duration: 720, start: 5040 },
    { name: 'FINAL_BOW', duration: 360, start: 5760 },
    { name: 'CURTAIN_CALL', duration: 300, start: 6120 }
  ];

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
    this.sequences.forEach(seq => {
        if (seq.name === 'CURTAIN_RISE' || seq.name === 'CURTAIN_CALL') return;

        const beats = seq.name.includes('TAP_DANCE') ? 16 : 8;
        for (let i = 0; i < beats; i++) {
            this.beatMap.push({
                time: seq.start + (i * (seq.duration / beats)),
                x: this.width * (0.2 + Math.random() * 0.6),
                y: this.height * (0.3 + Math.random() * 0.4)
            });
        }
    });
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

    // End dance after duration
    if (this.danceTimer >= this.DANCE_DURATION) {
      if (this.score > 5000) { // Require a minimum score to pass
          this.onStageComplete?.();
      } else {
          this.onGameOver?.();
      }
    }
  }

  private startDanceMusic() {
    // Play "Puttin' on the Ritz" music
    try {
      const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        // Load and play the dance music
        const danceMusic = new Audio('/sounds/puttin-on-the-ritz.mp3');
        danceMusic.loop = true;
        danceMusic.volume = 0.6; // Slightly lower volume for dance music
        danceMusic.play().catch(e => {
          console.warn('Could not play dance music:', e);
        });

        console.log("🎵 PLAYING: Performance Protocol");
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
    const upcomingBeats = this.beatMap.filter(beat => beat.time >= this.danceTimer && beat.time < this.danceTimer + 1);
    upcomingBeats.forEach(beat => {
        this.rhythmTargets.push({
            x: beat.x,
            y: beat.y,
            time: this.danceTimer,
            duration: 120, // 2 seconds to hit
            hit: false,
            missed: false,
            active: true
        });
    });

    // Update existing targets
    for (let i = this.rhythmTargets.length - 1; i >= 0; i--) {
        const target = this.rhythmTargets[i];
        if (!target.active) continue;

        const age = this.danceTimer - target.time;
        if (age > target.duration) {
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

  private drawRhythmTargets() {
    this.rhythmTargets.forEach(target => {
        if (!target.active) return;

        const age = this.danceTimer - target.time;
        const progress = age / target.duration;
        const radius = 20 + (1 - progress) * 30; // Shrinks as time runs out
        const alpha = 1 - progress;

        this.ctx.save();
        this.ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        this.ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.3})`;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    });
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
      '🎭 Performance Protocol Active 🎭',
      this.width / 2,
      this.height - 30,
      14,
      '#FFD700',
      'center'
    );
    
    // Applause effect
    if (this.applauseTimer > 0) {
      this.drawText(
        '👏 BRAVO! ENCORE! 👏',
        this.width / 2,
        this.height / 2,
        20,
        '#FF69B4',
        'center'
      );
    }
  }

  handleInput(event: KeyboardEvent) {
    // Allow skipping with spacebar
    if (event.code === 'Space') {
      this.danceTimer = this.DANCE_DURATION;
    }
  }

  handlePointerDown(x: number, y: number) {
    for (let i = this.rhythmTargets.length - 1; i >= 0; i--) {
        const target = this.rhythmTargets[i];
        if (target.active) {
            const dx = x - target.x;
            const dy = y - target.y;
            const age = this.danceTimer - target.time;
            const progress = age / target.duration;
            const radius = 20 + (1 - progress) * 30;

            if (Math.sqrt(dx * dx + dy * dy) < radius) {
                target.hit = true;
                target.active = false;
                this.combo++;
                this.score += 100 * this.combo;
                this.playerPerformance = Math.min(1, this.playerPerformance + 0.05);
                // Play a success sound
                return;
            }
        }
    }

    // Missed click
    this.combo = 0;
    this.playerPerformance = Math.max(0, this.playerPerformance - 0.02);
  }
}