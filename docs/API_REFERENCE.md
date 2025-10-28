# API Reference

## Game Classes

### BaseGame

Abstract base class for all game implementations.

```typescript
abstract class BaseGame {
  protected ctx: CanvasRenderingContext2D;
  protected width: number;
  protected height: number;
  protected isRunning: boolean;
  protected isPaused: boolean;
  
  // Event callbacks
  onScoreUpdate?: (score: number) => void;
  onGameOver?: () => void;
  onStageComplete?: () => void;
  
  // Mobile input handlers
  handleMobileMove?(x: number, y: number): void;
  handleMobileShoot?(x: number, y: number): void;
  handleMobileAction?(): void;
  
  // Abstract methods
  abstract init(): Promise<void> | void;
  abstract update(deltaTime: number): void;
  abstract render(): void;
  abstract handleInput(event: KeyboardEvent): void;
  
  // Public methods
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  destroy(): void;
  resize(width: number, height: number): void;
}
```

#### Methods

##### `init(): Promise<void> | void`
Initialize game resources and state. Called once when the game starts.

##### `update(deltaTime: number): void`
Update game logic. Called every frame with the time delta since last frame.

**Parameters:**
- `deltaTime` (number): Time in milliseconds since last update

##### `render(): void`
Render the game to the canvas. Called every frame after update.

##### `handleInput(event: KeyboardEvent): void`
Handle keyboard input events.

**Parameters:**
- `event` (KeyboardEvent): The keyboard event to handle

##### `start(): void`
Start the game loop and begin gameplay.

##### `pause(): void`
Pause the game loop while maintaining state.

##### `resume(): void`
Resume the game loop from paused state.

##### `stop(): void`
Stop the game loop and clean up resources.

##### `destroy(): void`
Destroy the game instance and clean up all resources.

##### `resize(width: number, height: number): void`
Resize the game canvas and update internal dimensions.

**Parameters:**
- `width` (number): New canvas width
- `height` (number): New canvas height

### PongGame

Classic Pong game implementation.

```typescript
class PongGame extends BaseGame {
  // Game state
  private player1: Paddle;
  private player2: Paddle;
  private ball: Ball;
  private score: { player1: number; player2: number };
  private powerups: Powerup[];
  private particles: ParticleSystem;
  
  // Game mechanics
  private spawnPowerup(): void;
  private activatePowerup(powerup: Powerup): void;
  private updateBall(): void;
  private updatePaddles(): void;
  private checkCollisions(): void;
}
```

#### Key Features
- **Power-ups**: Speed, fire, missile, wacky, shield, explosion, chain, shockwave, multiball, gravity, laser
- **AI Opponent**: Intelligent paddle movement
- **Particle Effects**: Visual feedback for collisions
- **Audio Integration**: Sound effects and music
- **Mobile Support**: Touch controls

### LasatGame

Last Starfighter-inspired space combat game.

```typescript
class LasatGame extends BaseGame {
  // Game state
  private player: Player;
  private enemies: Enemy[];
  private projectiles: Projectile[];
  private particles: ParticleSystem;
  private ragnarokPhase: number;
  private waveCompleteTimer: number;
  
  // Game mechanics
  private spawnRagnarokWave(): void;
  private spawnSinistarBoss(): void;
  private updateTargeting(): void;
  private shootIonCannon(): void;
  private activateDeathBlossom(): void;
}
```

#### Key Features
- **First-person Cockpit**: Immersive 3D-style view
- **Squadron Combat**: Multiple enemy types and formations
- **Targeting System**: Lock-on mechanics
- **Weapon Systems**: Lasers and ion cannons
- **Death Blossom**: Special attack ability
- **Boss Fights**: Multi-phase Sinistar boss
- **Enemy Commands**: Dynamic enemy announcements

### BreakoutGame

Enhanced Breakout with power-ups and paddle evolution.

```typescript
class BreakoutGame extends BaseGame {
  // Game state
  private paddle: Paddle;
  private ball: Ball;
  private bricks: Brick[];
  private powerups: Powerup[];
  private particles: ParticleSystem;
  private level: number;
  
  // Game mechanics
  private spawnPowerup(x: number, y: number): void;
  private activatePowerup(powerup: Powerup): void;
  private updatePaddle(): void;
  private updateBall(): void;
  private checkCollisions(): void;
}
```

#### Key Features
- **Power-ups**: Big explosions, paddle evolution, fire/ice effects
- **Paddle Evolution**: Grows, pulses, morphs into spaceship
- **Brick Destruction**: Visual and audio feedback
- **Level Progression**: Increasing difficulty
- **Mobile Controls**: Touch-based paddle movement

## State Management

### useGameStore

Main game state management store.

```typescript
interface GameStore {
  // State
  currentScreen: GameScreen;
  currentStage: number;
  gameState: GameState;
  unlockedStages: number;
  showDemo: boolean;
  productionMode: boolean;
  stageAttempts: Record<number, number>;
  
  // Actions
  setCurrentScreen: (screen: GameScreen) => void;
  setCurrentStage: (stage: number) => void;
  setGameState: (state: GameState) => void;
  setShowDemo: (show: boolean) => void;
  setProductionMode: (enabled: boolean) => void;
  unlockNextStage: () => void;
  goToNextStage: () => void;
  resetProgress: () => void;
  incrementAttempt: (stage: number) => void;
}
```

#### Types

```typescript
type GameScreen = 'menu' | 'stage-select' | 'game' | 'transition';
type GameState = 'playing' | 'paused' | 'ended' | 'stage-complete';
```

#### Methods

##### `setCurrentScreen(screen: GameScreen): void`
Change the current screen with validation.

**Parameters:**
- `screen` (GameScreen): The screen to navigate to

##### `setCurrentStage(stage: number): void`
Set the current game stage with validation.

**Parameters:**
- `stage` (number): The stage number (1-8)

##### `setGameState(state: GameState): void`
Update the game state with validation.

**Parameters:**
- `state` (GameState): The new game state

##### `unlockNextStage(): void`
Unlock the next stage in progression.

##### `goToNextStage(): void`
Advance to the next stage.

##### `resetProgress(): void`
Reset all progress and return to initial state.

### useScoreStore

Score and high score management.

```typescript
interface ScoreStore {
  // State
  scores: Record<number, number>;
  highScores: Record<number, number>;
  
  // Actions
  updateScore: (stage: number, score: number) => void;
  getHighScore: (stage: number) => number;
  getAllHighScores: () => Record<number, number>;
  resetScores: () => void;
}
```

#### Methods

##### `updateScore(stage: number, score: number): void`
Update the score for a specific stage with validation and anti-cheat.

**Parameters:**
- `stage` (number): The stage number (1-8)
- `score` (number): The score to set

##### `getHighScore(stage: number): number`
Get the high score for a specific stage.

**Parameters:**
- `stage` (number): The stage number (1-8)

**Returns:** The high score for the stage

##### `getAllHighScores(): Record<number, number>`
Get all high scores.

**Returns:** Object mapping stage numbers to high scores

### useSettingsStore

Game settings and preferences.

```typescript
interface SettingsStore {
  // State
  graphicsQuality: 'low' | 'medium' | 'high';
  fpsCap: 30 | 60 | 120 | 0;
  enableDprScaling: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  
  // Actions
  setGraphicsQuality: (quality: 'low' | 'medium' | 'high') => void;
  setFpsCap: (fps: 30 | 60 | 120 | 0) => void;
  setEnableDprScaling: (enabled: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setVoiceVolume: (volume: number) => void;
}
```

## Utility Classes

### ParticleSystem

Particle effect management system.

```typescript
class ParticleSystem {
  constructor(ctx: CanvasRenderingContext2D, maxParticles?: number);
  
  // Particle creation
  addExplosion(x: number, y: number, count?: number, color?: string, type?: 'subtle' | 'dramatic' | 'epic'): void;
  addTrail(x: number, y: number, vx: number, vy: number, color?: string): void;
  addScreenFlash(x: number, y: number, intensity: number): void;
  
  // System management
  update(): void;
  render(): void;
  clear(): void;
}
```

#### Methods

##### `addExplosion(x, y, count, color, type): void`
Create an explosion particle effect.

**Parameters:**
- `x` (number): X coordinate
- `y` (number): Y coordinate
- `count` (number): Number of particles (default: 20)
- `color` (string): Particle color (default: '#FFD700')
- `type` (string): Effect intensity (default: 'subtle')

##### `addTrail(x, y, vx, vy, color): void`
Create a particle trail effect.

**Parameters:**
- `x` (number): X coordinate
- `y` (number): Y coordinate
- `vx` (number): X velocity
- `vy` (number): Y velocity
- `color` (string): Trail color (default: '#00FFFF')

### PerformanceMonitor

Performance monitoring and metrics collection.

```typescript
class PerformanceMonitor {
  // Monitoring control
  startMonitoring(onUpdate?: (metrics: PerformanceMetrics) => void): void;
  stopMonitoring(): void;
  update(): void;
  
  // Metrics access
  getCurrentFPS(): number;
  getAverageFrameTime(): number;
  getPerformanceHistory(): PerformanceHistory[];
  getCurrentMetrics(): PerformanceMetrics | null;
  getPerformanceSummary(): PerformanceSummary;
  
  // Counters
  addDrawCall(): void;
  setParticleCount(count: number): void;
}
```

#### Interfaces

```typescript
interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage?: number;
  drawCalls: number;
  particleCount: number;
  averageFrameTime: number;
  frameTimeVariance: number;
  memoryPressure: 'low' | 'medium' | 'high';
  performanceScore: number;
  bottlenecks: string[];
  recommendations: string[];
}

interface PerformanceHistory {
  timestamp: number;
  metrics: PerformanceMetrics;
}

interface PerformanceSummary {
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  mainBottleneck?: string;
  recommendation?: string;
}
```

## React Components

### GameCanvas

Main game rendering component.

```typescript
interface GameCanvasProps {
  // Props are handled internally via stores
}

function GameCanvas(): JSX.Element;
```

#### Features
- **Dynamic Game Loading**: Loads games based on current stage
- **Canvas Management**: Handles sizing, DPR scaling, context
- **Event Handling**: Keyboard, pointer, mobile controls
- **Performance Monitoring**: Real-time metrics tracking
- **Error Boundaries**: Game-specific error handling

### PerformanceDashboard

Real-time performance monitoring UI.

```typescript
interface PerformanceDashboardProps {
  isVisible: boolean;
  onToggle: () => void;
}

function PerformanceDashboard({ isVisible, onToggle }: PerformanceDashboardProps): JSX.Element;
```

#### Features
- **Real-time Metrics**: FPS, frame time, memory usage
- **Performance History**: Visual timeline graph
- **Bottleneck Detection**: Identifies performance issues
- **Recommendations**: Actionable optimization suggestions
- **Export Functionality**: Download performance data

### ErrorBoundary

React error boundary for graceful error handling.

```typescript
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState>;
```

#### Features
- **Error Catching**: Catches JavaScript errors in child components
- **Fallback UI**: Displays error recovery interface
- **Error Reporting**: Logs errors for debugging
- **Recovery Options**: Restart, return to menu

## Hooks

### usePerformanceMonitor

React hook for performance monitoring integration.

```typescript
function usePerformanceMonitor(): {
  startMonitoring: () => void;
  stopMonitoring: () => void;
  addDrawCall: () => void;
  setParticleCount: (count: number) => void;
  getCurrentMetrics: () => PerformanceMetrics | null;
  getPerformanceSummary: () => PerformanceSummary;
};
```

#### Usage

```typescript
function GameComponent() {
  const { startMonitoring, stopMonitoring, addDrawCall } = usePerformanceMonitor();
  
  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, []);
  
  const handleRender = () => {
    addDrawCall();
    // Render logic
  };
}
```

### useIsMobile

Hook to detect mobile devices.

```typescript
function useIsMobile(): boolean;
```

#### Usage

```typescript
function ResponsiveComponent() {
  const isMobile = useIsMobile();
  
  return (
    <div>
      {isMobile ? <MobileControls /> : <DesktopControls />}
    </div>
  );
}
```

## Security Utilities

### Validation

Input validation and sanitization utilities.

```typescript
// Validation functions
function validateEmail(email: string): boolean;
function validateUsername(username: string): boolean;
function validateScore(score: number): boolean;
function validateStage(stage: number): boolean;

// Sanitization functions
function sanitizeHtml(input: string): string;
function normalizeWhitespace(input: string): string;
function truncate(input: string, maxLength: number): string;
```

### Security

Game-specific security measures.

```typescript
// Rate limiting
class RateLimiter {
  constructor(maxAttempts: number, windowMs: number);
  isAllowed(key: string): boolean;
  reset(key: string): void;
}

// Anti-cheat measures
const antiCheat = {
  detectImpossibleScore: (score: number, stage: number, timeElapsed: number) => boolean;
  detectRapidChanges: (timestamps: number[], threshold?: number) => boolean;
  validateProgression: (completedStages: number[], currentStage: number) => boolean;
};

// Game validators
const gameValidators = {
  gameStateTransition: (from: string, to: string) => boolean;
  stageUnlock: (currentStage: number, requestedStage: number) => boolean;
  inputFrequency: (lastInput: number, currentTime: number, minInterval?: number) => boolean;
  canvasDimensions: (width: number, height: number) => boolean;
};
```

## Mobile Controls

### MobileControlsManager

Touch-based input management.

```typescript
class MobileControlsManager {
  constructor(canvas: HTMLCanvasElement, callbacks: MobileControlCallbacks);
  
  destroy(): void;
  handleTouchStart(event: TouchEvent): void;
  handleTouchMove(event: TouchEvent): void;
  handleTouchEnd(event: TouchEvent): void;
}

interface MobileControlCallbacks {
  onMove: (x: number, y: number) => void;
  onShoot: (x: number, y: number) => void;
  onPause: () => void;
  onAction: () => void;
}
```

#### Features
- **Virtual Stick**: Analog movement control
- **Touch Gestures**: Tap, swipe, hold recognition
- **Haptic Feedback**: Vibration on actions
- **Responsive Design**: Adapts to screen size

## Audio System

### AudioState

Audio management and playback.

```typescript
interface AudioState {
  isMuted: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  
  playStinger: (sound: string) => Promise<void>;
  playMusic: (track: string) => Promise<void>;
  stopMusic: () => void;
  setMuted: (muted: boolean) => void;
  setMasterVolume: (volume: number) => void;
}
```

#### Available Sounds
- **Stingers**: `arcade_hit`, `arcade_powerup`, `starwars_explosion`, `defender_explosion`, `game_over`
- **Music**: `menu_theme`, `game_theme`, `boss_theme`
- **Voice**: `enemy_command`, `powerup_announcement`, `level_complete`

## Asset Management

### AssetLoader

Asset loading and management.

```typescript
class AssetLoader {
  static async loadImage(src: string): Promise<HTMLImageElement>;
  static async loadAudio(src: string): Promise<HTMLAudioElement>;
  static async loadFont(family: string, src: string): Promise<FontFace>;
  static preloadAssets(assets: AssetList): Promise<void>;
}

interface AssetList {
  images: string[];
  audio: string[];
  fonts: Array<{ family: string; src: string }>;
}
```

#### Usage

```typescript
// Load individual assets
const image = await AssetLoader.loadImage('/images/sprite.png');
const audio = await AssetLoader.loadAudio('/sounds/explosion.mp3');

// Preload multiple assets
await AssetLoader.preloadAssets({
  images: ['/images/player.png', '/images/enemy.png'],
  audio: ['/sounds/laser.mp3', '/sounds/hit.mp3'],
  fonts: [{ family: 'GameFont', src: '/fonts/game.woff2' }]
});
```

## Testing Utilities

### Test Helpers

Utilities for testing game components.

```typescript
// Mock canvas context
const createMockCanvasContext = (): CanvasRenderingContext2D;

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  memory: { usedJSHeapSize: 50 * 1024 * 1024 }
};

// Test game instance
class TestGame extends BaseGame {
  init(): void { /* mock implementation */ }
  update(deltaTime: number): void { /* mock implementation */ }
  render(): void { /* mock implementation */ }
  handleInput(event: KeyboardEvent): void { /* mock implementation */ }
}
```

#### Usage

```typescript
describe('GameComponent', () => {
  let mockCtx: CanvasRenderingContext2D;
  
  beforeEach(() => {
    mockCtx = createMockCanvasContext();
    jest.spyOn(performance, 'now').mockImplementation(() => Date.now());
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  it('should render correctly', () => {
    const game = new TestGame(mockCtx, 800, 600);
    game.render();
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
  });
});
```
