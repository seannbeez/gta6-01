// Talvera Heat — configuration and shared constants.
// All values below were authored in this recorded build session for gta6-01.
export const CFG = {
  title: 'TALVERA HEAT',
  subtitle: 'Streets of Talvera',
  cityName: 'Talvera',
  seed: 1337,
  // City grid: roads every 60 units, road width 14, city from -280 to 280.
  roadSpacing: 60,
  roadWidth: 14,
  roadHalf: 7,
  cityHalf: 280,
  blockSize: 46,
  // River along the south edge: water z in [292, 372], south bank z in [372, 452].
  riverNear: 292,
  riverFar: 372,
  southBankFar: 452,
  bridgeXs: [-120, 120],
  // Hurricane-sunset palette: low orange sun under a bruised purple storm
  // sky, wet mirror asphalt, neon against warm sand and terracotta.
  sky: 0x5b3a5e,
  fog: 0x7a4a58,
  sunColor: 0xff9a4d,
  groundColor: 0xc9b18a,
  roadColor: 0x4a3a36,
  sidewalkColor: 0xbfae90,
  riverColor: 0x2e7f8f,
  // Gameplay tuning.
  walkSpeed: 7.5,
  sprintSpeed: 11,
  carAccel: 16,
  carBrake: 30,
  carMaxSpeed: 42,
  carMaxReverse: 12,
  carTurn: 1.9,
  playerHealth: 100,
  punchDamage: 25,
  pistolDamage: 34,
  pistolRange: 55,
  wantedDecaySeconds: 25,
  saveKey: 'talvera-heat-save-v1',
};

// Colours for paint jobs, buildings and characters (all original, no brand colours).
export const PALETTE = {
  buildings: [0xd8c49a, 0xc9a06b, 0xe0d3b3, 0xb98d5f, 0x9fb4c0, 0xd9b48a, 0xc7b299, 0xa8b8a0],
  towers: [0x7fa8bf, 0x8fa9c4, 0xc4a06a, 0x9db3a8],
  carPaints: [0xc23b2e, 0x2e6fc2, 0xe0a92e, 0x3aa655, 0xe8e4da, 0x22242a, 0x7a4a9e, 0x2ec4b6],
  pedShirts: [0xd95f4b, 0x4b8fd9, 0xe0c34b, 0x6fbf5a, 0xd94b9e, 0x8a6fd9, 0xe8e4da, 0x3a3f4a],
  policeWhite: 0xf2f2f2,
  policeBlack: 0x1c1e26,
  policeLight: 0x2e6fd8,
};

// District names, all invented for Talvera (no real or commercial names).
export const DISTRICTS = [
  { name: 'Old Mill Quarter', cx: 0, cz: 400 },
  { name: 'Glass Row', cx: 0, cz: 0 },
  { name: 'Palm Boulevard', cx: -120, cz: -60 },
  { name: 'Copper Market', cx: 150, cz: 120 },
  { name: 'Riverside Promenade', cx: 0, cz: 270 },
  { name: 'Foundry Flats', cx: -180, cz: 180 },
];
