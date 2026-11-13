import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export function toTutorialStage(stage: number): StageId {
  return Math.min(Math.max(Math.round(stage) || 1, 1), 8) as StageId;
}

interface TutorialState {
  seen: Partial<Record<StageId, boolean>>;
  show: Partial<Record<StageId, boolean>>;
  markSeen: (stage: StageId) => void;
  maybeShow: (stage: StageId) => void;
  hide: (stage: StageId) => void;
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      seen: {},
      show: {},
      markSeen: (stage) => set((s) => ({ seen: { ...s.seen, [stage]: true }, show: { ...s.show, [stage]: false } })),
      maybeShow: (stage) => {
        const { seen } = get();
        if (!seen[stage]) {
          set((s) => ({ show: { ...s.show, [stage]: true } }));
        }
      },
      hide: (stage) => set((s) => ({ show: { ...s.show, [stage]: false } })),
    }),
    {
      name: 'cultural-arcade-tutorials',
      partialize: (s) => ({ seen: s.seen }),
    }
  )
);


