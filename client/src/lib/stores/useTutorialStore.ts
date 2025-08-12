import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type StageId = 1 | 2 | 3 | 4 | 5;

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


