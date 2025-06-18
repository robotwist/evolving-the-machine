export interface CulturalInfo {
  name: string;
  description: string;
  keyValues: string[];
  historicalContext: string;
  gameplayTips: string[];
}

export const CULTURAL_DATA: Record<number, CulturalInfo> = {
  1: {
    name: "Ancient Greek Olympic Spirit",
    description: "The ancient Greeks valued competition, excellence (arete), and fair play. The Olympic Games were a celebration of human achievement and divine honor.",
    keyValues: [
      "Fair competition",
      "Excellence in performance", 
      "Honor and respect",
      "Physical and mental balance"
    ],
    historicalContext: "The first Olympic Games were held in 776 BC in Olympia, Greece. They were held in honor of Zeus and included various athletic competitions.",
    gameplayTips: [
      "Both players have equal opportunity to score",
      "Victory comes through skill and practice",
      "Respect your opponent's efforts"
    ]
  },

  2: {
    name: "Mayan Astronomical Wisdom",
    description: "The Maya were master astronomers who used their knowledge of celestial movements for navigation, agriculture, and spiritual practices.",
    keyValues: [
      "Observation and learning",
      "Harmony with cosmic cycles",
      "Precision and calculation",
      "Respect for natural forces"
    ],
    historicalContext: "Mayan astronomers accurately predicted eclipses, tracked Venus cycles, and created detailed calendars that rivaled modern precision.",
    gameplayTips: [
      "Use momentum and trajectory like celestial bodies",
      "Observe patterns in asteroid movement",
      "Plan your path using cosmic knowledge"
    ]
  },

  3: {
    name: "Japanese Bushido Code",
    description: "The way of the warrior emphasized honor, courage, loyalty, and protection of the innocent. Samurai lived by strict moral principles.",
    keyValues: [
      "Honor above personal gain",
      "Courage in the face of danger",
      "Loyalty to duty",
      "Protection of the innocent"
    ],
    historicalContext: "Bushido developed during Japan's feudal period, emphasizing moral behavior, martial skill, and selfless service.",
    gameplayTips: [
      "Prioritize saving civilians over scoring points",
      "Face enemies with courage, not recklessness",
      "Honor requires protecting the weak"
    ]
  },

  4: {
    name: "Norse Warrior Culture",
    description: "Norse warriors valued bravery, honor in battle, and believed in facing destiny with courage. Ragnarok represents the eternal cycle of destruction and renewal.",
    keyValues: [
      "Courage in battle",
      "Honor through worthy deeds",
      "Acceptance of fate",
      "Strength through adversity"
    ],
    historicalContext: "Norse mythology speaks of Ragnarok, the twilight of the gods, where heroes fight valiantly despite knowing the outcome.",
    gameplayTips: [
      "Fight with honor even when outnumbered",
      "Use all abilities and weapons available",
      "Every battle matters in the greater war"
    ]
  }
};

export function getCulturalInfo(stage: number): CulturalInfo | null {
  return CULTURAL_DATA[stage] || null;
}

export function getAllCultures(): CulturalInfo[] {
  return Object.values(CULTURAL_DATA);
}
