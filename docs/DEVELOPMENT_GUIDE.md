# Development Guide

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **Git**: For version control
- **VS Code**: Recommended IDE with TypeScript support

### Installation

```bash
# Clone the repository
git clone https://github.com/robotwist/evolving-the-machine.git
cd evolving-the-machine

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Type check
npm run type-check
```

## Project Structure

```
evolving-the-machine/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── lib/          # Game logic and utilities
│   │   ├── hooks/        # Custom React hooks
│   │   └── stores/       # Zustand state stores
│   └── public/           # Static assets
├── server/               # Backend Express server
├── docs/                 # Documentation
├── tests/                # Test files
└── shared/               # Shared utilities
```

## Game Development

### Creating a New Game

1. **Extend BaseGame**: Create a new class that extends `BaseGame`
2. **Implement Required Methods**: `init()`, `update()`, `render()`, `handleInput()`
3. **Add Game Logic**: Implement game-specific mechanics
4. **Register Game**: Add to the game registry in `GameCanvas.tsx`

#### Example Game Structure

```typescript
// client/src/lib/games/MyGame.ts
import { BaseGame } from './BaseGame';

export class MyGame extends BaseGame {
  private player: Player;
  private enemies: Enemy[];
  private score: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    super(ctx, width, height);
    this.score = 0;
  }

  async init(): Promise<void> {
    // Initialize game resources
    this.player = new Player(this.width / 2, this.height - 50);
    this.enemies = [];
  }

  update(deltaTime: number): void {
    // Update game logic
    this.player.update(deltaTime);
    this.enemies.forEach(enemy => enemy.update(deltaTime));
    
    // Check collisions
    this.checkCollisions();
  }

  render(): void {
    // Clear canvas
    this.clearCanvas();
    
    // Render game objects
    this.player.render(this.ctx);
    this.enemies.forEach(enemy => enemy.render(this.ctx));
    
    // Render UI
    this.drawText(`Score: ${this.score}`, 10, 30);
  }

  handleInput(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowLeft':
        this.player.moveLeft();
        break;
      case 'ArrowRight':
        this.player.moveRight();
        break;
      case ' ':
        this.player.shoot();
        break;
    }
  }
}
```

### Game State Management

Games communicate with the UI through callbacks:

```typescript
// In your game class
this.onScoreUpdate?.(this.score);
this.onGameOver?.();
this.onStageComplete?.();
```

### Adding Power-ups

1. **Define Power-up Type**: Add to the power-up enum
2. **Create Power-up Class**: Implement power-up behavior
3. **Add Spawning Logic**: Determine when power-ups appear
4. **Handle Activation**: Implement power-up effects
5. **Add Visual Effects**: Use ParticleSystem for feedback

#### Example Power-up

```typescript
interface Powerup {
  x: number;
  y: number;
  type: 'speed' | 'fire' | 'shield' | 'multiball';
  active: boolean;
  duration: number;
}

class SpeedPowerup implements Powerup {
  x: number;
  y: number;
  type: 'speed' = 'speed';
  active: boolean = false;
  duration: number = 5000; // 5 seconds

  activate(game: BaseGame): void {
    // Increase game speed
    (game as any).speedMultiplier = 1.5;
    
    // Visual feedback
    if (game.particles) {
      game.particles.addExplosion(this.x, this.y, 30, '#00FF00', 'dramatic');
    }
    
    // Deactivate after duration
    setTimeout(() => {
      (game as any).speedMultiplier = 1.0;
    }, this.duration);
  }
}
```

## Component Development

### Creating React Components

1. **Use TypeScript**: Always use TypeScript for type safety
2. **Follow Naming Conventions**: PascalCase for components
3. **Use Functional Components**: Prefer hooks over class components
4. **Add Error Boundaries**: Wrap components in error boundaries

#### Example Component

```typescript
// client/src/components/MyComponent.tsx
import React, { useState, useEffect } from 'react';

interface MyComponentProps {
  title: string;
  onAction: (value: string) => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    // Component initialization
    console.log('Component mounted');
    
    return () => {
      // Cleanup
      console.log('Component unmounted');
    };
  }, []);

  const handleClick = () => {
    onAction(value);
  };

  return (
    <div className="my-component">
      <h2>{title}</h2>
      <input 
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter value"
      />
      <button onClick={handleClick}>
        Submit
      </button>
    </div>
  );
}
```

### State Management with Zustand

1. **Create Store**: Define store interface and implementation
2. **Add Persistence**: Use `persist` middleware for localStorage
3. **Add Validation**: Validate state changes
4. **Add Security**: Implement rate limiting and anti-cheat

#### Example Store

```typescript
// client/src/lib/stores/useMyStore.tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MyStore {
  data: string[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addData: (item: string) => void;
  removeData: (index: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useMyStore = create<MyStore>()(
  persist(
    (set, get) => ({
      data: [],
      isLoading: false,
      error: null,
      
      addData: (item: string) => {
        set((state) => ({
          data: [...state.data, item]
        }));
      },
      
      removeData: (index: number) => {
        set((state) => ({
          data: state.data.filter((_, i) => i !== index)
        }));
      },
      
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
      
      setError: (error: string | null) => {
        set({ error });
      }
    }),
    {
      name: 'my-store',
      version: 1
    }
  )
);
```

## Testing

### Writing Tests

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test complete user flows
4. **Performance Tests**: Test performance under load

#### Example Test

```typescript
// client/src/lib/games/__tests__/MyGame.test.ts
import { MyGame } from '../MyGame';

describe('MyGame', () => {
  let game: MyGame;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCtx = createMockCanvasContext();
    game = new MyGame(mockCtx, 800, 600);
  });

  afterEach(() => {
    game.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with correct dimensions', async () => {
      await game.init();
      expect(game).toBeDefined();
    });
  });

  describe('Game Logic', () => {
    it('should update player position', async () => {
      await game.init();
      const initialX = game.player.x;
      
      game.handleInput(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      game.update(16);
      
      expect(game.player.x).toBeGreaterThan(initialX);
    });
  });

  describe('Rendering', () => {
    it('should render game objects', async () => {
      await game.init();
      game.render();
      
      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(mockCtx.fillText).toHaveBeenCalled();
    });
  });
});
```

### Mocking

#### Canvas Context Mock

```typescript
const createMockCanvasContext = (): CanvasRenderingContext2D => {
  return {
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    scale: jest.fn(),
    fillText: jest.fn(),
    strokeText: jest.fn(),
    measureText: jest.fn(() => ({ width: 100 })),
    canvas: { width: 800, height: 600 }
  } as unknown as CanvasRenderingContext2D;
};
```

#### Performance API Mock

```typescript
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024,
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 200 * 1024 * 1024
  }
};

Object.defineProperty(window, 'performance', {
  value: mockPerformance,
  writable: true
});
```

## Performance Optimization

### Canvas Optimization

1. **Minimize State Changes**: Group similar operations
2. **Use Transform**: Use `translate()`, `rotate()`, `scale()` instead of manual calculations
3. **Batch Operations**: Group similar draw calls
4. **Cull Off-screen**: Skip rendering off-screen objects

#### Example Optimized Rendering

```typescript
render(): void {
  this.ctx.save();
  
  // Batch similar operations
  this.ctx.fillStyle = '#FF0000';
  this.enemies.forEach(enemy => {
    if (this.isOnScreen(enemy)) {
      this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }
  });
  
  this.ctx.fillStyle = '#00FF00';
  this.powerups.forEach(powerup => {
    if (this.isOnScreen(powerup)) {
      this.ctx.fillRect(powerup.x, powerup.y, powerup.width, powerup.height);
    }
  });
  
  this.ctx.restore();
}

private isOnScreen(obj: { x: number; y: number; width: number; height: number }): boolean {
  return obj.x + obj.width >= 0 && 
         obj.x <= this.width && 
         obj.y + obj.height >= 0 && 
         obj.y <= this.height;
}
```

### Memory Management

1. **Object Pooling**: Reuse objects instead of creating new ones
2. **Asset Management**: Load/unload assets as needed
3. **Garbage Collection**: Minimize object creation
4. **Memory Monitoring**: Track memory usage

#### Example Object Pool

```typescript
class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;

  constructor(createFn: () => T, resetFn: (obj: T) => void) {
    this.createFn = createFn;
    this.resetFn = resetFn;
  }

  get(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    this.resetFn(obj);
    this.pool.push(obj);
  }
}

// Usage
const bulletPool = new ObjectPool(
  () => new Bullet(0, 0, 0, 0),
  (bullet) => bullet.reset()
);
```

## Security Best Practices

### Input Validation

1. **Validate All Inputs**: Check types, ranges, and formats
2. **Sanitize Data**: Clean user input before processing
3. **Rate Limiting**: Prevent abuse and spam
4. **Anti-cheat**: Detect and prevent cheating

#### Example Validation

```typescript
function validateGameInput(input: unknown): GameInput {
  if (typeof input !== 'object' || input === null) {
    throw new ValidationError('Invalid input format');
  }

  const { x, y, action } = input as Record<string, unknown>;
  
  // Validate coordinates
  const xNum = Number(x);
  const yNum = Number(y);
  
  if (isNaN(xNum) || isNaN(yNum)) {
    throw new ValidationError('Invalid coordinates');
  }
  
  // Clamp to reasonable bounds
  const clampedX = Math.max(-10000, Math.min(10000, xNum));
  const clampedY = Math.max(-10000, Math.min(10000, yNum));
  
  // Validate action
  const validActions = ['move', 'shoot', 'pause'];
  const sanitizedAction = validActions.includes(String(action)) ? String(action) : 'move';
  
  return { x: clampedX, y: clampedY, action: sanitizedAction };
}
```

### Rate Limiting

```typescript
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(
    private maxAttempts: number,
    private windowMs: number
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    return true;
  }
}
```

## Mobile Development

### Touch Controls

1. **Virtual Stick**: Implement analog movement control
2. **Gesture Recognition**: Handle swipe, tap, hold gestures
3. **Haptic Feedback**: Provide tactile feedback
4. **Responsive Design**: Adapt to different screen sizes

#### Example Touch Handler

```typescript
class TouchHandler {
  private startX: number = 0;
  private startY: number = 0;
  private isActive: boolean = false;

  handleTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.isActive = true;
  }

  handleTouchMove(event: TouchEvent): void {
    if (!this.isActive) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - this.startX;
    const deltaY = touch.clientY - this.startY;
    
    // Convert to game coordinates
    const gameX = (deltaX / this.canvas.width) * this.gameWidth;
    const gameY = (deltaY / this.canvas.height) * this.gameHeight;
    
    this.onMove?.(gameX, gameY);
  }

  handleTouchEnd(): void {
    this.isActive = false;
    this.onEnd?.();
  }
}
```

## Deployment

### Build Process

1. **TypeScript Compilation**: Compile TypeScript to JavaScript
2. **Asset Optimization**: Optimize images, audio, fonts
3. **Code Splitting**: Split code for better loading
4. **Minification**: Minify JavaScript and CSS

### Environment Configuration

```typescript
// Environment variables
const config = {
  development: {
    apiUrl: 'http://localhost:5000',
    debug: true,
    enableDevTools: true
  },
  production: {
    apiUrl: 'https://api.evolvingthemachine.com',
    debug: false,
    enableDevTools: false
  }
};
```

### CI/CD Pipeline

1. **GitHub Actions**: Automated testing and deployment
2. **Quality Gates**: Linting, testing, security checks
3. **Build Verification**: Ensure successful builds
4. **Deployment**: Automatic deployment to Netlify

## Debugging

### Development Tools

1. **React DevTools**: Debug React components
2. **Redux DevTools**: Debug state management
3. **Performance Profiler**: Profile performance
4. **Console Logging**: Strategic logging for debugging

### Common Issues

#### Canvas Not Rendering
- Check canvas context initialization
- Verify canvas dimensions
- Ensure render loop is running

#### Performance Issues
- Profile with Performance Monitor
- Check for memory leaks
- Optimize rendering loops

#### State Management Issues
- Verify store subscriptions
- Check state mutations
- Validate state transitions

## Contributing

### Code Style

1. **TypeScript**: Use strict mode
2. **ESLint**: Follow configured rules
3. **Prettier**: Use automatic formatting
4. **Conventional Commits**: Use standard commit messages

### Pull Request Process

1. **Create Feature Branch**: Branch from main
2. **Write Tests**: Add tests for new features
3. **Update Documentation**: Update relevant docs
4. **Submit PR**: Create pull request with description
5. **Code Review**: Address review feedback
6. **Merge**: Merge after approval

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

#### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tool changes

#### Examples
```
feat(game): add laser powerup to Pong
fix(ui): resolve mobile control positioning
docs(api): update game class documentation
test(game): add unit tests for BreakoutGame
```

## Resources

### Documentation
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Canvas API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

### Tools
- [VS Code](https://code.visualstudio.com/)
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Performance Monitor](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

### Testing
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Canvas Testing Guide](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
