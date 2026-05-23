export const SIMULATION_CONFIG = {
  seed: 918273,
  populationSize: 200,
  generationDuration: 20,
  arenaSize: 48,
  maxAge: 90,
  topology: [14, 16, 6],
  neuralPresets: [
    {
      id: 'light',
      label: 'Leve',
      topology: [14, 16, 6],
    },
    {
      id: 'medium',
      label: 'Médio',
      topology: [14, 24, 12, 6],
    },
    {
      id: 'high',
      label: 'Alto',
      topology: [14, 32, 16, 6],
    },
    {
      id: 'experimental',
      label: 'Experimental',
      topology: [14, 48, 24, 6],
    },
  ],
  speed: {
    defaultMultiplier: 8,
    simulationScale: 1,
    fixedStep: 0.08,
    maxSubsteps: 8,
    cpuBudgetMs: 8,
  },
  food: {
    count: 160,
    energy: 0.85,
    collectRadius: 1.75,
  },
  predator: {
    count: 3,
    speed: 3,
    wanderSpeed: 1.8,
    visionRadius: 7,
    retargetInterval: 2.6,
    eatRadius: 0.75,
    reward: 9,
  },
  obstacles: {
    lakePenalty: 0.25,
    mountainPenalty: 10,
  },
  trails: {
    visible: false,
    preserveHistory: false,
    maxArchivedGenerations: 5,
  },
  planet: {
    radius: 360,
    surfaceOffset: 0.42,
  },
  evolution: {
    mutationRate: 0.08,
    mutationStrength: 0.35,
    eliteRatio: 0.12,
    crossoverRate: 0.75,
    randomNewcomers: 0.08,
  },
};
