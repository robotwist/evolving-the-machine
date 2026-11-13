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

    test('a shield saves a ball that gets past you, so the AI does not score', () => {
      internals.player1.shielded = true;
      aiScoresPoint();

      expect(internals.player2.score).toBe(0);
      expect(internals.player1.damage).toBe(0);
      expect(internals.player1.shielded).toBe(false);
      expect(internals.ball.dx).toBeGreaterThan(0);
    });

    test('conceding five points ends the match exactly once', () => {
      for (let i = 0; i < 5; i++) aiScoresPoint();
      for (let i = 0; i < 5; i++) game.update(1000 / 60);

      expect(onGameOver).toHaveBeenCalledTimes(1);
    });
  });

  describe('scoring and difficulty', () => {
    test('the reported score counts only the player’s points', () => {
      const reported: number[] = [];
      game.onScoreUpdate = (score) => reported.push(score);

      aiScoresPoint();
      aiScoresPoint();

      expect(reported).toEqual([0, 0]);
    });

    test('AI difficulty depends on the score, not on how long the player has led', () => {
      const ai = game as unknown as { aiAggression: number; updateAI: (dt: number) => void };
      internals.player1.score = 2;
      ai.updateAI(1000 / 60);
      const afterOneUpdate = ai.aiAggression;
      for (let i = 0; i < 300; i++) ai.updateAI(1000 / 60);

      expect(ai.aiAggression).toBe(afterOneUpdate);
    });

    test('the mobile shield button has a cooldown', () => {
      game.handleMobileAction();
      expect(internals.player1.shielded).toBe(true);

      internals.player1.shielded = false;
      (game as unknown as { shieldTimer: number }).shieldTimer = 0;
      game.handleMobileAction();

      expect(internals.player1.shielded).toBe(false);
    });
  });

  describe('aiming', () => {
    function returnBallAtOffset(offsetFromCenter: number) {
      const { player1, ball } = internals;
      ball.type = 'normal';
      ball.x = player1.x + player1.width + ball.radius + 1;
      ball.y = player1.y + player1.height / 2 + offsetFromCenter;
      ball.dx = -4.8;
      ball.dy = 0;
      game.update(1000 / 60);
      return Math.atan2(internals.ball.dy, internals.ball.dx);
    }

    test('a center hit returns the ball nearly straight', () => {
      expect(Math.abs(returnBallAtOffset(0))).toBeLessThan(0.1);
    });

    test('an edge hit returns the ball at a steep angle', () => {
      expect(returnBallAtOffset(45)).toBeGreaterThan(0.6);
      expect(returnBallAtOffset(-45)).toBeLessThan(-0.6);
    });
  });
});
