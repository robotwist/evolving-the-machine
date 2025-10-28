# Game Architecture Documentation

## Overview

Evolving The Machine is a retro arcade game collection built with modern web technologies. The architecture follows a modular, component-based design with clear separation of concerns.

## Core Architecture

### Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **State Management**: Zustand with persistence
- **Canvas Rendering**: HTML5 Canvas 2D API
- **Testing**: Jest + React Testing Library
- **Build Tools**: Vite, ESBuild
- **Deployment**: Netlify

### Project Structure

```
client/src/
├── components/          # React UI components
│   ├── GameCanvas.tsx  # Main game rendering component
│   ├── GameUI.tsx      # Game overlay UI
│   ├── MainMenu.tsx    # Main menu component
│   └── ...
├── lib/
│   ├── games/          # Game implementations
│   │   ├── BaseGame.ts # Abstract base class
│   │   ├── PongGame.ts # Pong implementation
│   │   ├── LasatGame.ts # Last Starfighter game
│   │   └── ...
│   ├── stores/         # Zustand state stores
│   │   ├── useGameStore.tsx
│   │   ├── useScoreStore.tsx
│   │   └── useSettingsStore.tsx
│   ├── utils/          # Utility functions
│   │   ├── ParticleSystem.ts
│   │   ├── PerformanceMonitor.ts
│   │   └── ...
│   └── controls/       # Input handling
│       └── MobileControls.ts
└── hooks/              # Custom React hooks
    ├── usePerformanceMonitor.ts
    └── useIsMobile.ts
```

## Game Architecture

### Base Game Class

All games inherit from `BaseGame`, which provides:

- **Game Loop Management**: Start, stop, pause, resume
- **Event Handling**: Keyboard input, pointer events
- **Canvas Operations**: Drawing utilities, text rendering
- **Performance Monitoring**: FPS tracking, frame timing
- **Mobile Support**: Touch/gesture handling

```typescript
abstract class BaseGame {
  protected ctx: CanvasRenderingContext2D;
  protected width: number;
  protected height: number;
  
  abstract init(): Promise<void> | void;
  abstract update(deltaTime: number): void;
  abstract render(): void;
  abstract handleInput(event: KeyboardEvent): void;
}
```

### Game State Management

Games communicate with the UI through callbacks:

- `onScoreUpdate(score: number)`: Updates player score
- `onGameOver()`: Handles game over state
- `onStageComplete()`: Handles stage completion

### Rendering Pipeline

1. **Clear Canvas**: `clearCanvas()`
2. **Update Game Logic**: `update(deltaTime)`
3. **Render Game Objects**: `render()`
4. **Update UI**: Score, lives, power-ups
5. **Performance Monitoring**: Track metrics

## State Management Architecture

### Zustand Stores

#### Game Store (`useGameStore`)
- **Current Screen**: menu, stage-select, game, transition
- **Current Stage**: 1-8 (game levels)
- **Game State**: playing, paused, ended, stage-complete
- **Unlocked Stages**: Progress tracking
- **Production Mode**: Environment detection

#### Score Store (`useScoreStore`)
- **Current Scores**: Per-stage scores
- **High Scores**: Best scores per stage
- **Score Validation**: Anti-cheat measures
- **Rate Limiting**: Prevent score spam

#### Settings Store (`useSettingsStore`)
- **Graphics Quality**: low, medium, high
- **Audio Settings**: Master, music, SFX, voice volumes
- **Performance Settings**: FPS cap, DPR scaling
- **Accessibility**: Voice style, particle effects

### State Persistence

All stores use Zustand's `persist` middleware for localStorage persistence:

```typescript
export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // Store implementation
    }),
    {
      name: 'game-store',
      version: 2,
      migrate: (persistedState, version) => {
        // Migration logic
      }
    }
  )
);
```

## Component Architecture

### Game Canvas Component

The `GameCanvas` component is the core rendering component:

- **Canvas Management**: Size, context, DPR scaling
- **Game Instance Management**: Dynamic game loading
- **Event Handling**: Keyboard, pointer, mobile controls
- **Performance Monitoring**: Real-time metrics
- **Error Boundaries**: Game-specific error handling

### UI Components

#### Main Menu
- **Game Selection**: Stage selection interface
- **Settings Access**: Graphics, audio, performance
- **Progress Display**: Unlocked stages, high scores

#### Game UI
- **Score Display**: Current score, high score
- **Lives Counter**: Player lives remaining
- **Power-up Indicators**: Active power-ups
- **Performance Dashboard**: Real-time metrics (Ctrl+Shift+P)

#### Mobile UI
- **Virtual Controls**: Touch-based game controls
- **Gesture Recognition**: Swipe, tap, hold
- **Responsive Layout**: Adaptive to screen size

## Input Handling Architecture

### Desktop Controls
- **Keyboard Events**: Arrow keys, WASD, spacebar
- **Event Delegation**: Centralized input handling
- **Key Mapping**: Configurable key bindings

### Mobile Controls
- **Touch Events**: Pointer down, move, up
- **Virtual Stick**: Analog movement control
- **Gesture Recognition**: Tap, swipe, hold
- **Haptic Feedback**: Vibration on actions

### Input Validation
- **Rate Limiting**: Prevent input spam
- **Sanitization**: Clean input data
- **Security**: Anti-cheat measures

## Performance Architecture

### Performance Monitoring

The `PerformanceMonitor` class tracks:

- **FPS**: Frames per second with variance
- **Frame Time**: Average and variance
- **Memory Usage**: JavaScript heap usage
- **Draw Calls**: Rendering operations count
- **Particle Count**: Active particles
- **Performance Score**: Composite 0-100 score

### Optimization Strategies

#### Particle System Optimization
- **Object Pooling**: Reuse particle objects
- **Quality Scaling**: Adjust particle count by quality
- **In-place Compaction**: Reduce memory allocations
- **Batch Rendering**: Group similar operations

#### Rendering Optimization
- **Canvas Context Management**: Minimize state changes
- **Draw Call Batching**: Group similar operations
- **Culling**: Skip off-screen objects
- **Level of Detail**: Reduce complexity at distance

#### Memory Management
- **Asset Loading**: Lazy loading, preloading
- **Garbage Collection**: Minimize allocations
- **Resource Cleanup**: Proper disposal
- **Memory Monitoring**: Track usage patterns

## Security Architecture

### Input Validation
- **Type Checking**: Runtime type validation
- **Range Validation**: Bounds checking
- **Sanitization**: Clean user input
- **Rate Limiting**: Prevent abuse

### Anti-Cheat Measures
- **Score Validation**: Detect impossible scores
- **Progression Validation**: Ensure valid stage unlocks
- **Timing Validation**: Detect automation
- **State Validation**: Verify game state transitions

### Content Security Policy
- **Resource Validation**: Validate external URLs
- **Nonce Generation**: Secure inline scripts
- **Domain Whitelisting**: Allow specific domains

## Testing Architecture

### Test Structure
- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **E2E Tests**: Full user flow testing
- **Performance Tests**: Load and stress testing

### Test Coverage
- **Game Logic**: Core game mechanics
- **State Management**: Store operations
- **UI Components**: React component behavior
- **Utilities**: Helper function testing

### Mocking Strategy
- **Canvas Context**: Mock 2D rendering context
- **Performance API**: Mock timing functions
- **Local Storage**: Mock persistence
- **Audio System**: Mock sound effects

## Deployment Architecture

### Build Process
1. **TypeScript Compilation**: Type checking and compilation
2. **Vite Bundling**: Module bundling and optimization
3. **Asset Processing**: Image, audio, font optimization
4. **Code Splitting**: Dynamic imports for performance

### CI/CD Pipeline
- **GitHub Actions**: Automated testing and deployment
- **Quality Gates**: Linting, testing, security checks
- **Build Verification**: Ensure successful builds
- **Deployment**: Automatic Netlify deployment

### Environment Configuration
- **Development**: Hot reload, debugging tools
- **Staging**: Production-like testing environment
- **Production**: Optimized, minified builds

## Error Handling Architecture

### Error Boundaries
- **React Error Boundaries**: Catch component errors
- **Game Error Boundaries**: Game-specific error handling
- **Fallback UI**: Graceful error recovery
- **Error Reporting**: Logging and monitoring

### Error Types
- **Game Errors**: Game logic failures
- **Rendering Errors**: Canvas rendering issues
- **State Errors**: Store operation failures
- **Network Errors**: API communication issues

### Recovery Strategies
- **Graceful Degradation**: Fallback to simpler features
- **State Reset**: Return to known good state
- **User Notification**: Inform user of issues
- **Automatic Recovery**: Attempt automatic fixes

## Mobile Architecture

### Responsive Design
- **Viewport Adaptation**: Dynamic sizing
- **Touch Optimization**: Touch-friendly controls
- **Performance Scaling**: Adjust quality for mobile
- **Battery Optimization**: Reduce CPU usage

### Progressive Web App
- **Service Worker**: Offline functionality
- **App Manifest**: Native app-like experience
- **Install Prompts**: Add to home screen
- **Push Notifications**: Engagement features

## Future Architecture Considerations

### Scalability
- **Microservices**: Break down monolithic backend
- **CDN Integration**: Global content delivery
- **Database Integration**: Persistent data storage
- **Real-time Features**: WebSocket communication

### Performance
- **WebGL Migration**: Hardware-accelerated rendering
- **Web Workers**: Background processing
- **Streaming**: Progressive asset loading
- **Caching**: Intelligent resource caching

### Features
- **Multiplayer**: Real-time multiplayer support
- **Social Features**: Leaderboards, achievements
- **Analytics**: User behavior tracking
- **A/B Testing**: Feature experimentation

## Development Guidelines

### Code Style
- **TypeScript Strict**: Enable strict type checking
- **ESLint**: Consistent code formatting
- **Prettier**: Automatic code formatting
- **Conventional Commits**: Standardized commit messages

### Git Workflow
- **Feature Branches**: Isolated development
- **Pull Requests**: Code review process
- **Automated Testing**: CI/CD integration
- **Semantic Versioning**: Version management

### Documentation
- **API Documentation**: Comprehensive API docs
- **Code Comments**: Inline documentation
- **Architecture Docs**: System design docs
- **User Guides**: End-user documentation
