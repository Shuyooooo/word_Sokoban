import type { CellTerrain, GridSnapshot } from './GridModel';

type ParsedCell = {
  terrain: CellTerrain;
  player: boolean;
  blockText: string | null;
};

function makeEmptyTerrain(): CellTerrain {
  return { wall: false, goal: false, door: false };
}

function parseToken(rawToken: string): ParsedCell {
  const parts = rawToken.split('+').filter(Boolean);
  const cell: ParsedCell = {
    terrain: makeEmptyTerrain(),
    player: false,
    blockText: null,
  };

  for (const p of parts) {
    if (p === '#') {
      cell.terrain.wall = true;
      continue;
    }
    if (p === '.' || p === '') continue;
    if (p === 'G') {
      cell.terrain.goal = true;
      continue;
    }
    if (p === '门') {
      cell.terrain.door = true;
      continue;
    }
    if (p === '@') {
      cell.player = true;
      continue;
    }

    // 其它 token 视为“词块”（1-3字）
    cell.blockText = p;
  }

  return cell;
}

export function parseLevelFromInlineString(levelText: string): GridSnapshot {
  const lines = levelText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error('Level text is empty.');
  }

  const rows = lines.map((l) => l.split(/\s+/).filter(Boolean));
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;

  const terrain: CellTerrain[][] = [];
  const blocks: { text: string; x: number; y: number }[] = [];
  let playerFound = false;
  let player = { x: 0, y: 0 };

  for (let y = 0; y < height; y++) {
    const row: CellTerrain[] = [];
    for (let x = 0; x < width; x++) {
      const tok = rows[y][x] ?? '.';
      const parsed = parseToken(tok);

      row.push(parsed.terrain);

      if (parsed.player) {
        if (playerFound) throw new Error('Multiple player spawns found.');
        playerFound = true;
        player = { x, y };
      }

      if (parsed.blockText) {
        blocks.push({ text: parsed.blockText, x, y });
      }
    }
    terrain.push(row);
  }

  if (!playerFound) throw new Error('No player spawn (@) found.');

  let doorCount = 0;
  for (const row of terrain) {
    for (const c of row) {
      if (c.door) doorCount++;
    }
  }
  if (doorCount > 1) {
    throw new Error('Level must have at most one 门 tile.');
  }

  return {
    width,
    height,
    terrain,
    player,
    blocks: blocks.map((b, idx) => ({ id: `P${idx}`, text: b.text, x: b.x, y: b.y })),
  };
}

export type Coord = { x: number; y: number };
export type ConfigBlock = Coord & { text: string };

export type StoryRuleEvent = 'BlockAdded' | 'SteamStarted' | 'TigerKilled' | 'LevelWon';

/** 故事配色：叙述偏红，词条偏青 */
export type StorySegmentKind = 'narration' | 'term';

export type StorySegment = {
  text: string;
  kind: StorySegmentKind;
};

export type StoryRule = {
  on: StoryRuleEvent;
  /** 仅 BlockAdded：与方块内部 text 一致（如「小水」） */
  text?: string;
  /** 整段叙述色（无 lineSegments 时使用） */
  line?: string;
  /** 双色分段（优先于 line） */
  lineSegments?: StorySegment[];
  /** 默认 true：该条规则每场只触发一次 */
  once?: boolean;
};

export type LevelConfig = {
  id: number;
  cellSize?: number;
  size: { width: number; height: number };
  playerStart: Coord;
  doorPos: Coord;
  walls: Coord[];
  blocks: ConfigBlock[];
  playerName?: string;
  tigerName?: string;
  tigerPos?: Coord;
  levelType?: 'tigerDoor' | 'fireWaterLove' | 'bioRepair';
  firePos?: Coord;
  waterPos?: Coord;
  disableRandomKnife?: boolean;
  /** 无 storyIntroSegments 时用整段红字 */
  storyIntro?: string;
  storyIntroSegments?: StorySegment[];
  storyRules?: StoryRule[];
};

function inRange(n: number, min: number, max: number) {
  return n >= min && n <= max;
}

// User-facing coordinate system: bottom-left origin.
function toInternalY(height: number, yBottomLeft: number): number {
  return height - 1 - yBottomLeft;
}

function assertCoordInBounds(name: string, c: Coord, width: number, height: number) {
  if (!inRange(c.x, 0, width - 1) || !inRange(c.y, 0, height - 1)) {
    throw new Error(`${name} out of bounds: (${c.x}, ${c.y}) for ${width}x${height}`);
  }
}

function isEdgeCoord(c: Coord, width: number, height: number) {
  return c.x === 0 || c.y === 0 || c.x === width - 1 || c.y === height - 1;
}

function isNearEdgeCoord(c: Coord, width: number, height: number) {
  return c.x <= 1 || c.y <= 1 || c.x >= width - 2 || c.y >= height - 2;
}

export function parseLevelFromConfig(config: LevelConfig): GridSnapshot {
  const width = config.size.width;
  const height = config.size.height;

  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 5 || height < 5) {
    throw new Error(`Invalid level size: ${width}x${height}. Minimum supported size is 5x5.`);
  }

  assertCoordInBounds('playerStart', config.playerStart, width, height);
  assertCoordInBounds('doorPos', config.doorPos, width, height);
  if (config.tigerPos) {
    assertCoordInBounds('tigerPos', config.tigerPos, width, height);
  }
  if (config.firePos) {
    assertCoordInBounds('firePos', config.firePos, width, height);
  }
  if (config.waterPos) {
    assertCoordInBounds('waterPos', config.waterPos, width, height);
  }

  const terrain: CellTerrain[][] = [];
  for (let y = 0; y < height; y++) {
    const row: CellTerrain[] = [];
    for (let x = 0; x < width; x++) row.push(makeEmptyTerrain());
    terrain.push(row);
  }

  const wallSet = new Set<string>();
  for (const w of config.walls) {
    assertCoordInBounds('wall', w, width, height);
    const key = `${w.x},${w.y}`;
    if (wallSet.has(key)) continue;
    wallSet.add(key);
    terrain[toInternalY(height, w.y)][w.x].wall = true;
  }

  const doorCell = terrain[toInternalY(height, config.doorPos.y)][config.doorPos.x];
  doorCell.wall = false;
  doorCell.door = true;

  const playerInternal = {
    x: config.playerStart.x,
    y: toInternalY(height, config.playerStart.y),
  };
  if (terrain[playerInternal.y][playerInternal.x].wall) {
    throw new Error('playerStart cannot be on wall.');
  }

  const blocks = config.blocks.map((b, idx) => {
    assertCoordInBounds(`block[${idx}]`, b, width, height);
    if (isEdgeCoord(b, width, height)) {
      throw new Error(`block[${idx}] cannot be on edge: (${b.x}, ${b.y})`);
    }
    if (b.text === '刀' && isNearEdgeCoord(b, width, height)) {
      throw new Error(`Knife block cannot be near edge: (${b.x}, ${b.y})`);
    }
    const by = toInternalY(height, b.y);
    if (terrain[by][b.x].wall) {
      throw new Error(`block[${idx}] cannot be on wall.`);
    }
    return {
      id: `C${idx}`,
      text: b.text,
      x: b.x,
      y: by,
    };
  });

  // 剧情关默认随机刷一把“刀”（若配置中还没给）
  const hasKnife = blocks.some((b) => b.text === '刀');
  if ((config.levelType ?? 'tigerDoor') === 'tigerDoor' && !hasKnife && !config.disableRandomKnife) {
    const tigerInternal = config.tigerPos
      ? { x: config.tigerPos.x, y: toInternalY(height, config.tigerPos.y) }
      : null;
    const occupied = new Set<string>();
    occupied.add(`${playerInternal.x},${playerInternal.y}`);
    if (tigerInternal) occupied.add(`${tigerInternal.x},${tigerInternal.y}`);
    for (const b of blocks) occupied.add(`${b.x},${b.y}`);

    const knifeCandidates: Coord[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 未指定位置时，随机刀也不允许贴边（最外圈 + 次外圈）
        if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) continue;
        if (terrain[y][x].wall || terrain[y][x].door) continue;
        if (occupied.has(`${x},${y}`)) continue;
        knifeCandidates.push({ x, y });
      }
    }
    if (knifeCandidates.length > 0) {
      const pick = knifeCandidates[Math.floor(Math.random() * knifeCandidates.length)];
      blocks.push({ id: `C${blocks.length}`, text: '刀', x: pick.x, y: pick.y });
    }
  }

  return {
    width,
    height,
    terrain,
    player: playerInternal,
    playerText: config.playerName ?? '人',
    tigerText: config.tigerName ?? '猛虎',
    levelType: config.levelType ?? 'tigerDoor',
    tigerPos: config.tigerPos
      ? { x: config.tigerPos.x, y: toInternalY(height, config.tigerPos.y) }
      : null,
    firePos: config.firePos
      ? { x: config.firePos.x, y: toInternalY(height, config.firePos.y) }
      : null,
    waterPos: config.waterPos
      ? { x: config.waterPos.x, y: toInternalY(height, config.waterPos.y) }
      : null,
    blocks,
  };
}

