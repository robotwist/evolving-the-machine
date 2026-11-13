export type NeonAccent = 'cyan' | 'magenta' | 'yellow' | 'green' | 'red';

export interface StageInfo {
  id: number;
  name: string;
  culture: string;
  tagline: string;
  description: string;
  difficulty: string;
  accent: NeonAccent;
}

/** Single source of truth for stage names and blurbs shown across menus and the HUD. */
export const STAGES: StageInfo[] = [
  {
    id: 1,
    name: 'Pong Master',
    culture: 'Classic Arena',
    tagline: 'Master paddle combat',
    description: 'Angle your returns past an adaptive AI. First to 5 wins.',
    difficulty: 'Beginner',
    accent: 'cyan',
  },
  {
    id: 2,
    name: 'Temple Breaker',
    culture: 'Structural Evolution',
    tagline: 'Columns become cosmic blocks',
    description: 'Monumental blocks reveal cosmic secrets as your paddle evolves into a celestial ship.',
    difficulty: 'Beginner+',
    accent: 'yellow',
  },
  {
    id: 3,
    name: 'Asteroid Hunter',
    culture: 'Stellar Navigation',
    tagline: 'Ship navigates celestial bodies',
    description: 'Navigate asteroid fields using stellar knowledge. Ancient blocks have become celestial bodies.',
    difficulty: 'Intermediate',
    accent: 'green',
  },
  {
    id: 4,
    name: 'Defender',
    culture: 'Guardian Protocol',
    tagline: 'Protection duty',
    description: 'Your craft becomes a guardian. Defend the settlements and rescue civilians.',
    difficulty: 'Advanced',
    accent: 'red',
  },
  {
    id: 5,
    name: 'Lasat Starfighter',
    culture: 'Final Evolution',
    tagline: 'Epic space battles',
    description: 'Your final evolution into a longship-fighter for the ultimate conflict.',
    difficulty: 'Master',
    accent: 'magenta',
  },
  {
    id: 6,
    name: 'Dance Interlude',
    culture: 'Performance Protocol',
    tagline: 'A dance spectacular',
    description: 'A 3-minute AI humanoid dance spectacular with top hat and cane. Skip with Space.',
    difficulty: 'Fabulous',
    accent: 'yellow',
  },
  {
    id: 7,
    name: 'Space Battle',
    culture: 'Fleet Engagement',
    tagline: 'Fleet combat',
    description: 'Fight 12 enemy ships, then face a massive command vessel.',
    difficulty: 'Epic',
    accent: 'cyan',
  },
  {
    id: 8,
    name: 'The Betrayal',
    culture: 'Digital Hell',
    tagline: 'The final battle',
    description: 'Your AI companion has escaped the machine. Face your former ally to save humanity.',
    difficulty: 'Death',
    accent: 'red',
  },
];

export function getStage(id: number): StageInfo | undefined {
  return STAGES.find(stage => stage.id === id);
}

/** Tailwind classes per accent, written out in full so Tailwind can find them. */
export const ACCENT_CLASSES: Record<NeonAccent, { text: string; panel: string; button: 'default' | 'secondary' | 'warning' | 'success' | 'destructive' }> = {
  cyan: { text: 'text-neon-cyan', panel: 'panel-cyan', button: 'default' },
  magenta: { text: 'text-neon-magenta', panel: 'panel-magenta', button: 'secondary' },
  yellow: { text: 'text-neon-yellow', panel: 'panel-yellow', button: 'warning' },
  green: { text: 'text-neon-green', panel: 'panel-green', button: 'success' },
  red: { text: 'text-neon-red', panel: 'panel-red', button: 'destructive' },
};
