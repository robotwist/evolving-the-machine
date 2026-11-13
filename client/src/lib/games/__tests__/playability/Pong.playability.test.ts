import { PongGame } from '../../PongGame';
import { describePlayability, holdKeys, playMany, report } from './harness';

type PongView = {
  player1: { y: number; height: number; damage: number };
  ball: { x: number; y: number; dx: number };
};

/**
 * Human-like Pong player: reacts ~0.2 s after the ball turns toward them, aims each
 * return off-center by a random amount, and misjudges position by up to 25 px.
 */
function humanLikeBot() {
  let incomingSince: number | null = null;
  let aimOffset = 0;
  return (game: PongGame, frame: number, rng: () => number) => {
    const view = game as unknown as PongView;
    const incoming = view.ball.dx < 0;
    if (incoming && incomingSince === null) {
      incomingSince = frame;
      aimOffset = (rng() * 2 - 1) * 30 + (rng() * 2 - 1) * 25;
    }
    if (!incoming) incomingSince = null;

    const paddleCenter = view.player1.y + view.player1.height / 2 + aimOffset;
    const reacting = incomingSince !== null && frame - incomingSince >= 12;
    const target = reacting ? view.ball.y : incoming ? paddleCenter : 350;
    holdKeys(game, target < paddleCenter - 6 ? ['KeyW'] : target > paddleCenter + 6 ? ['KeyS'] : []);
  };
}

describePlayability('Pong playability', () => {
  test('human-like player: fair, winnable, and finishes in a few minutes', async () => {
    const { summary } = await playMany(PongGame, 60, { maxSeconds: 600, bot: humanLikeBot() });
    report('Pong / human-like', summary);

    expect(summary.errors).toEqual([]);
    expect(summary.duplicateEndCallbacks).toBe(0);
    expect(summary.timeoutRate).toBeLessThanOrEqual(0.03);
    expect(summary.winRate).toBeGreaterThanOrEqual(0.7);
    expect(summary.winRate).toBeLessThanOrEqual(0.9);
    expect(summary.medianSeconds).toBeGreaterThanOrEqual(90);
    expect(summary.medianSeconds).toBeLessThanOrEqual(360);
  }, 600_000);
});
