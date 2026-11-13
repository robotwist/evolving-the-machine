import { BaseGame } from '../../BaseGame';
import { FlashExplosions } from '../FlashExplosions';
import { ScreenShake } from '../ScreenShake';
import { vibrate } from '../haptics';
import { getGameSettings } from '../settings';
import { createMockCanvasContext } from '../../../utils/__tests__/testUtils';

type SettingsGlobals = Record<string, unknown>;

const SETTING_KEYS = [
  '__CULTURAL_ARCADE_FPS_CAP__',
  '__CULTURAL_ARCADE_SCREEN_SHAKE__',
  '__CULTURAL_ARCADE_REDUCE_MOTION__',
  '__CULTURAL_ARCADE_QUALITY__',
  '__CULTURAL_ARCADE_HAPTICS_ENABLED__',
  '__CULTURAL_ARCADE_HAPTICS__',
];

function setGlobals(values: SettingsGlobals) {
  Object.assign(window, values);
}

class TestGame extends BaseGame {
  inputs: string[] = [];
  updates = 0;
  renders = 0;
  init() {}
  update() {
    this.updates++;
  }
  render() {
    this.renders++;
  }
  /** Feeds a sequence of frame gaps through the loop's timing logic. */
  runFrames(gapsMs: number[]) {
    let now = 0;
    for (const gap of gapsMs) {
      now += gap;
      this.advance(gap, now);
    }
  }
  handleInput(event: KeyboardEvent) {
    this.inputs.push(event.code);
  }
  run() {
    this.isRunning = true;
  }
  heldKeys() {
    return Array.from(this.keys);
  }
  teardown() {
    this.cleanup();
  }
}

function press(code: string, type: 'keydown' | 'keyup' = 'keydown', target: HTMLElement | Document = document) {
  const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  for (const key of SETTING_KEYS) delete (window as unknown as SettingsGlobals)[key];
});

describe('BaseGame keyboard input', () => {
  let game: TestGame;

  beforeEach(() => {
    game = new TestGame(createMockCanvasContext() as CanvasRenderingContext2D, 800, 600);
  });

  afterEach(() => game.teardown());

  test('ignores keys until the game is running', () => {
    press('KeyA');
    expect(game.heldKeys()).toEqual([]);
    expect(game.inputs).toEqual([]);
  });

  test('tracks held keys and forwards keydown to handleInput', () => {
    game.run();
    press('KeyA');
    press('KeyD');
    press('KeyA', 'keyup');
    expect(game.heldKeys()).toEqual(['KeyD']);
    expect(game.inputs).toEqual(['KeyA', 'KeyD']);
  });

  test('clears held keys when the window loses focus or the game pauses', () => {
    game.run();
    press('KeyW');
    window.dispatchEvent(new Event('blur'));
    expect(game.heldKeys()).toEqual([]);

    press('KeyW');
    game.pause();
    expect(game.heldKeys()).toEqual([]);
  });

  test('prevents page scrolling for game keys but not while typing', () => {
    game.run();
    expect(press('Space').defaultPrevented).toBe(true);

    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(press('Space', 'keydown', input).defaultPrevented).toBe(false);
    input.remove();
  });

  test('cleanup removes listeners', () => {
    game.run();
    game.teardown();
    press('KeyA');
    expect(game.inputs).toEqual([]);
  });
});

describe('BaseGame fixed-timestep loop', () => {
  let game: TestGame;

  beforeEach(() => {
    game = new TestGame(createMockCanvasContext() as CanvasRenderingContext2D, 800, 600);
  });

  afterEach(() => game.teardown());

  test('runs exactly one update per frame on a jittery 60 Hz display', () => {
    const gaps = Array.from({ length: 120 }, (_, i) => (i % 2 ? 16.5 : 16.8));
    game.runFrames(gaps);
    expect(game.updates).toBe(120);
    expect(game.renders).toBe(120);
  });

  test('keeps 60 updates per second on a 120 Hz display', () => {
    game.runFrames(Array(240).fill(1000 / 120));
    expect(game.updates).toBe(120);
  });

  test('catches up after a dropped frame', () => {
    game.runFrames([1000 / 60, (1000 / 60) * 2, 1000 / 60]);
    expect(game.updates).toBe(4);
    expect(game.renders).toBe(3);
  });

  test('drops the backlog after a long stall instead of fast-forwarding', () => {
    game.runFrames([2000, 1000 / 60]);
    expect(game.updates).toBe(6);
  });

  test('the FPS cap limits rendering but not simulation speed', () => {
    setGlobals({ __CULTURAL_ARCADE_FPS_CAP__: 30 });
    game.runFrames(Array(60).fill(1000 / 60));
    expect(game.updates).toBe(60);
    expect(game.renders).toBe(30);
  });
});

describe('getGameSettings', () => {
  test('falls back to defaults when nothing is configured', () => {
    expect(getGameSettings()).toMatchObject({
      fpsCap: 60,
      quality: 'medium',
      reduceMotion: false,
      screenShake: true,
      hapticsEnabled: true,
    });
  });

  test('normalizes unknown quality values', () => {
    setGlobals({ __CULTURAL_ARCADE_QUALITY__: 'ultra' });
    expect(getGameSettings().quality).toBe('medium');
    setGlobals({ __CULTURAL_ARCADE_QUALITY__: 'low' });
    expect(getGameSettings().quality).toBe('low');
  });
});

describe('ScreenShake', () => {
  function shakeWith(settings: SettingsGlobals) {
    setGlobals(settings);
    const ctx = createMockCanvasContext() as CanvasRenderingContext2D;
    return { ctx, shake: new ScreenShake(ctx) };
  }

  test('jitters the context for the requested number of frames', () => {
    const { ctx, shake } = shakeWith({});
    shake.trigger(2);
    shake.trigger(1); // shorter trigger does not cut an active shake short

    for (let i = 0; i < 3; i++) {
      shake.begin();
      shake.end();
    }

    expect(ctx.translate).toHaveBeenCalledTimes(2);
    expect(ctx.save).toHaveBeenCalledTimes(3);
    expect(ctx.restore).toHaveBeenCalledTimes(3);
    expect(shake.active).toBe(false);
  });

  test.each([
    ['screen shake disabled', { __CULTURAL_ARCADE_SCREEN_SHAKE__: false }],
    ['reduce motion enabled', { __CULTURAL_ARCADE_REDUCE_MOTION__: true }],
  ])('does nothing with %s', (_label, settings) => {
    const { ctx, shake } = shakeWith(settings);
    shake.trigger(10);
    shake.begin();
    shake.end();
    expect(shake.active).toBe(false);
    expect(ctx.translate).not.toHaveBeenCalled();
  });
});

describe('vibrate', () => {
  test('maps presets to patterns and respects the haptics setting', () => {
    const haptics = { vibrate: jest.fn() };
    setGlobals({ __CULTURAL_ARCADE_HAPTICS__: haptics });

    vibrate('hit');
    vibrate([10, 20]);
    expect(haptics.vibrate).toHaveBeenNthCalledWith(1, 50);
    expect(haptics.vibrate).toHaveBeenNthCalledWith(2, [10, 20]);

    setGlobals({ __CULTURAL_ARCADE_HAPTICS_ENABLED__: false });
    vibrate('explosion');
    expect(haptics.vibrate).toHaveBeenCalledTimes(2);
  });
});

describe('FlashExplosions', () => {
  test('shrinks and expires explosions after their lifetime', () => {
    const explosions = new FlashExplosions();
    explosions.spawn(10, 10, 30, 3);
    explosions.update();
    explosions.update();
    expect(explosions.count).toBe(1);
    explosions.update();
    expect(explosions.count).toBe(0);
  });
});
