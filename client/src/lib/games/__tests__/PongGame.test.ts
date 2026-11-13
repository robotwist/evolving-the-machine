import { PongGame } from '../PongGame';
import { createMockCanvasContext } from '../../utils/__tests__/testUtils';

type PaddleState = { x: number; y: number; width: number; height: number; damage: number; score: number; shielded?: boolean };

type PongInternals = {
  keys: Set<string>;
  player1: PaddleState;
  player2: PaddleState;
  ball: { x: number; y: number; dx: number; dy: number; radius: number; type: string };
};

describe('PongGame', () => {
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

  function aiScoresPoint() {
    const { ball } = internals;
    ball.type = 'normal';
    ball.x = -50;
    ball.y = 300;
    ball.dx = -5;
    ball.dy = 0;
    game.update(1000 / 60);
  }

  describe('paddle collisions', () => {
    test('meeting the ball while moving the paddle forward counts as a single return', () => {
      aimBallAtPlayerPaddle(-4.8, 2);
      internals.keys.add('KeyD');

      for (let i = 0; i < 30; i++) game.update(1000 / 60);

      expect(internals.ball.dx).toBeGreaterThan(0);
      expect(onGameOver).not.toHaveBeenCalled();
    });

    test('a ball fast enough to skip past the paddle in one update still bounces', () => {
      aimBallAtPlayerPaddle(-40, 5);

      game.update(1000 / 60);

      expect(internals.ball.dx).toBeGreaterThan(0);
      expect(internals.ball.x).toBeGreaterThan(internals.player1.x + internals.player1.width);
    });
  });

  describe('damage', () => {
    test('returning the ball does not damage your paddle', () => {
      for (let i = 0; i < 10; i++) {
        aimBallAtPlayerPaddle(-4.8, 1);
        game.update(1000 / 60);
      }

      expect(internals.player1.damage).toBe(0);
    });

    test('each point the AI scores damages your paddle', () => {
      aiScoresPoint();

      expect(internals.player2.score).toBe(1);
      expect(internals.player1.damage).toBe(20);
    });

    test('a shield absorbs the damage from one AI point', () => {
      internals.player1.shielded = true;
      aiScoresPoint();

      expect(internals.player1.damage).toBe(0);
      expect(internals.player1.shielded).toBe(false);
    });

    test('conceding five points ends the match exactly once', () => {
      for (let i = 0; i < 5; i++) aiScoresPoint();
      for (let i = 0; i < 5; i++) game.update(1000 / 60);

      expect(onGameOver).toHaveBeenCalledTimes(1);
    });
  });
});
