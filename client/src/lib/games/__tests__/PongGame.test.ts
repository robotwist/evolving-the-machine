import { PongGame } from '../PongGame';
import { createMockCanvasContext } from '../../utils/__tests__/testUtils';

type PongInternals = {
  keys: Set<string>;
  player1: { x: number; y: number; width: number; height: number; damage: number };
  ball: { x: number; y: number; dx: number; dy: number; radius: number; type: string };
};

describe('PongGame paddle collisions', () => {
  let game: PongGame;
  let internals: PongInternals;
  const onGameOver = jest.fn();

  beforeEach(async () => {
    onGameOver.mockClear();
    game = new PongGame(createMockCanvasContext() as CanvasRenderingContext2D, 800, 600);
    await game.init();
    game.onGameOver = onGameOver;
    internals = game as unknown as PongInternals;
  });

  function aimBallAtPlayerPaddle(dx: number, gap: number) {
    const { player1, ball } = internals;
    ball.type = 'normal';
    ball.x = player1.x + player1.width + ball.radius + gap;
    ball.y = player1.y + player1.height / 2;
    ball.dx = dx;
    ball.dy = 0;
  }

  test('meeting the ball while moving the paddle forward counts as a single hit', () => {
    aimBallAtPlayerPaddle(-4.8, 2);
    internals.keys.add('KeyD');

    for (let i = 0; i < 30; i++) game.update(1000 / 60);

    expect(internals.player1.damage).toBe(15);
    expect(onGameOver).not.toHaveBeenCalled();
    expect(internals.ball.dx).toBeGreaterThan(0);
  });

  test('a ball fast enough to skip past the paddle in one update still bounces', () => {
    aimBallAtPlayerPaddle(-40, 5);

    game.update(1000 / 60);

    expect(internals.ball.dx).toBeGreaterThan(0);
    expect(internals.ball.x).toBeGreaterThan(internals.player1.x + internals.player1.width);
  });
});
