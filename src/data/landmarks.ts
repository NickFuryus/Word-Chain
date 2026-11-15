export type MilestoneLandmarkId =
  | 'flatiron'
  | 'eiffel_tower'
  | 'chrysler'
  | 'empire_state'
  | 'space_needle'
  | 'transamerica'
  | 'cn_tower'
  | 'bank_of_china'
  | 'petronas'
  | 'burj_al_arab'
  | 'taipei_101'
  | 'shard'
  | 'one_wtc'
  | 'shanghai_tower'
  | 'burj_khalifa';

export type ProceduralSilhouetteType =
  | 'tapered'
  | 'stepped_setbacks'
  | 'twin_core'
  | 'diagrid'
  | 'cantilevered';

export type FacadeTextureType =
  | 'vertical_fins'
  | 'curtain_grid'
  | 'diagonal_lattice'
  | 'horizontal_bands'
  | 'chevron_ribs';

export type SpireCrownType =
  | 'needle'
  | 'chamfered_crown'
  | 'helipad_halo'
  | 'twin_antennas'
  | 'crystalline_peak';

export interface PrestigeTierDef {
  cycle: number;
  id: 'standard' | 'gold_blueprint' | 'neon_cyber' | 'orbital_chrome';
  name: string;
  multiplier: number;
  accentColor: string;
  badgeIcon: string;
}

export const PRESTIGE_TIERS: PrestigeTierDef[] = [
  { cycle: 0, id: 'standard', name: 'Standard Blueprint', multiplier: 1.0, accentColor: '#38bdf8', badgeIcon: '📐' },
  { cycle: 1, id: 'gold_blueprint', name: 'Gold Blueprint', multiplier: 1.5, accentColor: '#fbbf24', badgeIcon: '🏆' },
  { cycle: 2, id: 'neon_cyber', name: 'Neon Cyber', multiplier: 2.0, accentColor: '#f43f5e', badgeIcon: '⚡' },
  { cycle: 3, id: 'orbital_chrome', name: 'Orbital Chrome', multiplier: 2.5, accentColor: '#e2e8f0', badgeIcon: '🛰️' },
];

export function getPrestigeForLevel(level: number): PrestigeTierDef {
  const cycle = Math.floor((Math.max(1, level) - 1) / 75);
  if (cycle === 0) return PRESTIGE_TIERS[0];
  if (cycle === 1) return PRESTIGE_TIERS[1];
  if (cycle === 2) return PRESTIGE_TIERS[2];
  return {
    ...PRESTIGE_TIERS[3],
    cycle,
    multiplier: 2.5 + (cycle - 3) * 0.5,
    name: cycle > 3 ? `Orbital Chrome ${cycle - 2}` : 'Orbital Chrome',
  };
}

export interface MilestoneLandmarkDef {
  milestoneLevel: number;
  id: MilestoneLandmarkId;
  name: string;
  city: string;
  heightM: number;
  icon: string;
  fact: string;
  accentColor: string;
  primaryColor: string;
  secondaryColor: string;
  windowTint: string;
}

export const MILESTONE_LANDMARKS: MilestoneLandmarkDef[] = [
  {
    milestoneLevel: 5,
    id: 'flatiron',
    name: 'Flatiron Building',
    city: 'New York',
    heightM: 87,
    icon: '📐',
    fact: 'Originally named the Fuller Building, its triangular steel-frame lot tapers to just 6.5 feet (2 meters) wide at its northern tip.',
    accentColor: '#fbbf24',
    primaryColor: '#78716c',
    secondaryColor: '#44403c',
    windowTint: '#fef08a',
  },
  {
    milestoneLevel: 10,
    id: 'eiffel_tower',
    name: 'Eiffel Tower',
    city: 'Paris',
    heightM: 330,
    icon: '🗼',
    fact: 'Built of puddle iron, the tower can grow up to 15 cm (6 inches) taller during hot summer days due to thermal expansion.',
    accentColor: '#f59e0b',
    primaryColor: '#57534e',
    secondaryColor: '#292524',
    windowTint: '#fde047',
  },
  {
    milestoneLevel: 15,
    id: 'chrysler',
    name: 'Chrysler Building',
    city: 'New York',
    heightM: 319,
    icon: '🦅',
    fact: "Its iconic terraced sunburst crown is clad in Nirosta stainless steel and was secretly assembled inside the building's fire shaft.",
    accentColor: '#e2e8f0',
    primaryColor: '#312e81',
    secondaryColor: '#1e1b4b',
    windowTint: '#fed7aa',
  },
  {
    milestoneLevel: 20,
    id: 'empire_state',
    name: 'Empire State Building',
    city: 'New York',
    heightM: 381,
    icon: '🏛️',
    fact: 'Its original 102nd-floor spire was designed as a mooring mast for passenger airships, though severe updrafts made docking too dangerous.',
    accentColor: '#fbbf24',
    primaryColor: '#475569',
    secondaryColor: '#334155',
    windowTint: '#fef08a',
  },
  {
    milestoneLevel: 25,
    id: 'space_needle',
    name: 'Space Needle',
    city: 'Seattle',
    heightM: 184,
    icon: '🛸',
    fact: "Built for the 1962 World's Fair, its foundation is buried 30 feet deep and weighs as much as the entire above-ground steel structure.",
    accentColor: '#38bdf8',
    primaryColor: '#cbd5e1',
    secondaryColor: '#475569',
    windowTint: '#bae6fd',
  },
  {
    milestoneLevel: 30,
    id: 'transamerica',
    name: 'Transamerica Pyramid',
    city: 'San Francisco',
    heightM: 260,
    icon: '🔺',
    fact: 'Its four-sided pyramid shape and two external wings housing elevator shafts allow natural light and air to reach the streets below.',
    accentColor: '#94a3b8',
    primaryColor: '#64748b',
    secondaryColor: '#334155',
    windowTint: '#e2e8f0',
  },
  {
    milestoneLevel: 35,
    id: 'cn_tower',
    name: 'CN Tower',
    city: 'Toronto',
    heightM: 553,
    icon: '📡',
    fact: 'Originally built to solve broadcast signal interference caused by downtown skyscrapers, its main observation pod sits 1,136 feet above ground.',
    accentColor: '#f43f5e',
    primaryColor: '#64748b',
    secondaryColor: '#1e293b',
    windowTint: '#bae6fd',
  },
  {
    milestoneLevel: 40,
    id: 'bank_of_china',
    name: 'Bank of China Tower',
    city: 'Hong Kong',
    heightM: 367,
    icon: '🎋',
    fact: 'Designed by I. M. Pei, its asymmetrical triangular prism frame was inspired by growing bamboo shoots to minimize structural steel.',
    accentColor: '#22d3ee',
    primaryColor: '#164e63',
    secondaryColor: '#0f172a',
    windowTint: '#a5f3fc',
  },
  {
    milestoneLevel: 45,
    id: 'petronas',
    name: 'Petronas Towers',
    city: 'Kuala Lumpur',
    heightM: 452,
    icon: '🏙️',
    fact: "The twin towers were constructed simultaneously by two competing consortia—one led by Japan's Hazama Corporation and the other by South Korea's Samsung C&T.",
    accentColor: '#38bdf8',
    primaryColor: '#334155',
    secondaryColor: '#1e293b',
    windowTint: '#e0f2fe',
  },
  {
    milestoneLevel: 50,
    id: 'burj_al_arab',
    name: 'Burj Al Arab',
    city: 'Dubai',
    heightM: 321,
    icon: '⛵',
    fact: 'Built on an artificial island 280 meters offshore, its sail-shaped facade is a double-layered Teflon-coated woven fiberglass screen that reflects desert heat.',
    accentColor: '#38bdf8',
    primaryColor: '#0284c7',
    secondaryColor: '#0f172a',
    windowTint: '#e0f2fe',
  },
  {
    milestoneLevel: 55,
    id: 'taipei_101',
    name: 'Taipei 101',
    city: 'Taipei',
    heightM: 508,
    icon: '🏮',
    fact: 'Suspended between its 87th and 92nd floors is a 660-metric-ton gilded steel pendulum that sways to counteract typhoon winds and earthquakes.',
    accentColor: '#10b981',
    primaryColor: '#065f46',
    secondaryColor: '#064e3b',
    windowTint: '#a7f3d0',
  },
  {
    milestoneLevel: 60,
    id: 'shard',
    name: 'The Shard',
    city: 'London',
    heightM: 310,
    icon: '💎',
    fact: 'Its spire is clad in 11,000 angled panes of low-iron glass designed to reflect changing sky conditions across London.',
    accentColor: '#e879f9',
    primaryColor: '#4a044e',
    secondaryColor: '#3b0764',
    windowTint: '#f5d0fe',
  },
  {
    milestoneLevel: 65,
    id: 'one_wtc',
    name: 'One World Trade Center',
    city: 'New York',
    heightM: 541,
    icon: '🗽',
    fact: 'Standing 1,776 feet tall in reference to the U.S. Declaration of Independence, its square base rotates 45 degrees as it rises to form an octagon.',
    accentColor: '#38bdf8',
    primaryColor: '#0369a1',
    secondaryColor: '#0c4a6e',
    windowTint: '#bae6fd',
  },
  {
    milestoneLevel: 70,
    id: 'shanghai_tower',
    name: 'Shanghai Tower',
    city: 'Shanghai',
    heightM: 632,
    icon: '🌀',
    fact: 'Its asymmetrical, 120-degree twisted glass facade reduces wind loads by 24%, saving approximately $58 million in structural steel during construction.',
    accentColor: '#22d3ee',
    primaryColor: '#0e7490',
    secondaryColor: '#164e63',
    windowTint: '#cffafe',
  },
  {
    milestoneLevel: 75,
    id: 'burj_khalifa',
    name: 'Burj Khalifa',
    city: 'Dubai',
    heightM: 828,
    icon: '✨',
    fact: 'The exterior cladding uses over 24,000 glass panels, and condensation from its cooling system collects roughly 15 million gallons of water each year for landscaping.',
    accentColor: '#818cf8',
    primaryColor: '#1e1b4b',
    secondaryColor: '#0f172a',
    windowTint: '#c7d2fe',
  },
];

const DISTRICT_PALETTES = [
  { district: 'Midtown Steel', primary: '#334155', secondary: '#1e293b', accent: '#38bdf8', window: '#fde047' },
  { district: 'Harbor Glass', primary: '#0e7490', secondary: '#164e63', accent: '#22d3ee', window: '#e0f2fe' },
  { district: 'Terracotta Deco', primary: '#7c2d12', secondary: '#431407', accent: '#fb923c', window: '#fed7aa' },
  { district: 'Emerald District', primary: '#065f46', secondary: '#064e3b', accent: '#34d399', window: '#a7f3d0' },
  { district: 'Obsidian Plaza', primary: '#1e1b4b', secondary: '#0f172a', accent: '#818cf8', window: '#c7d2fe' },
  { district: 'Crimson Spire', primary: '#881337', secondary: '#4c0519', accent: '#f43f5e', window: '#fecdd3' },
  { district: 'Copper Heights', primary: '#78350f', secondary: '#451a03', accent: '#fbbf24', window: '#fef08a' },
  { district: 'Cobalt Exchange', primary: '#1d4ed8', secondary: '#1e3a8a', accent: '#60a5fa', window: '#dbeafe' },
];

const SILHOUETTES: ProceduralSilhouetteType[] = [
  'tapered',
  'stepped_setbacks',
  'twin_core',
  'diagrid',
  'cantilevered',
];

const FACADE_TEXTURES: FacadeTextureType[] = [
  'vertical_fins',
  'curtain_grid',
  'diagonal_lattice',
  'horizontal_bands',
  'chevron_ribs',
];

const SPIRE_CROWNS: SpireCrownType[] = [
  'needle',
  'chamfered_crown',
  'helipad_halo',
  'twin_antennas',
  'crystalline_peak',
];

const PROCEDURAL_PREFIXES = [
  'Apex',
  'Aether',
  'Beacon',
  'Civic',
  'Crown',
  'Horizon',
  'Meridian',
  'Monolith',
  'Nexus',
  'Pinnacle',
  'Solaris',
  'Stratos',
  'Titan',
  'Vanguard',
  'Vertex',
  'Zenith',
];

const PROCEDURAL_SUFFIXES = [
  'Tower',
  'Plaza',
  'Center',
  'Exchange',
  'Arcology',
  'Spire',
  'Atrium',
  'Commons',
  'Citadel',
  'Pavilion',
];

export interface LevelBlueprint {
  level: number;
  isMilestone: boolean;
  milestone?: MilestoneLandmarkDef;
  prestige: PrestigeTierDef;
  targetFloors: number;
  name: string;
  subtitle: string;
  icon: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  windowTint: string;
  procedural?: {
    silhouette: ProceduralSilhouetteType;
    facade: FacadeTextureType;
    crown: SpireCrownType;
    district: string;
    seed: number;
    taperRatio: number;
    setbackCount: number;
  };
}

function seededHash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export function getTargetFloorsForLevel(level: number): number {
  const base = 4 + Math.min(6, Math.floor((Math.max(1, level) - 1) / 10));
  return level % 5 === 0 ? base + 2 : base;
}

export function getLevelBlueprint(level: number): LevelBlueprint {
  const safeLevel = Math.max(1, level);
  const prestige = getPrestigeForLevel(safeLevel);
  const targetFloors = getTargetFloorsForLevel(safeLevel);

  if (safeLevel % 5 === 0) {
    const milestoneIndex = (Math.floor(safeLevel / 5) - 1) % MILESTONE_LANDMARKS.length;
    const milestone = MILESTONE_LANDMARKS[milestoneIndex];
    return {
      level: safeLevel,
      isMilestone: true,
      milestone,
      prestige,
      targetFloors,
      name: prestige.cycle > 0 ? `${milestone.name} (${prestige.name})` : milestone.name,
      subtitle: `${milestone.city} • ${milestone.heightM}m`,
      icon: milestone.icon,
      primaryColor: milestone.primaryColor,
      secondaryColor: milestone.secondaryColor,
      accentColor: prestige.cycle > 0 ? prestige.accentColor : milestone.accentColor,
      windowTint: milestone.windowTint,
    };
  }

  const h1 = seededHash(safeLevel * 37);
  const h2 = seededHash(safeLevel * 101 + 17);
  const h3 = seededHash(safeLevel * 211 + 53);

  const silhouette = SILHOUETTES[h1 % SILHOUETTES.length];
  const facade = FACADE_TEXTURES[h2 % FACADE_TEXTURES.length];
  const crown = SPIRE_CROWNS[h3 % SPIRE_CROWNS.length];
  const palette = DISTRICT_PALETTES[(h1 + h2) % DISTRICT_PALETTES.length];
  const prefix = PROCEDURAL_PREFIXES[h1 % PROCEDURAL_PREFIXES.length];
  const suffix = PROCEDURAL_SUFFIXES[h3 % PROCEDURAL_SUFFIXES.length];

  return {
    level: safeLevel,
    isMilestone: false,
    prestige,
    targetFloors,
    name: `${prefix} ${suffix}`,
    subtitle: `${palette.district} • Blueprint #${safeLevel}`,
    icon: '🏗️',
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    accentColor: prestige.cycle > 0 ? prestige.accentColor : palette.accent,
    windowTint: palette.window,
    procedural: {
      silhouette,
      facade,
      crown,
      district: palette.district,
      seed: h1,
      taperRatio: 0.42 + ((h2 % 28) / 100),
      setbackCount: 3 + (h3 % 3),
    },
  };
}
