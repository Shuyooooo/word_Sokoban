export type Dir = { dx: number; dy: number };

export type CellTerrain = {
  wall: boolean;
  goal: boolean;
  /** 可走；玩家站上去即通关（与 wall 互斥） */
  door: boolean;
};

export type Block = {
  id: string;
  text: string; // 1-3 汉字（一个词）
  x: number;
  y: number;
};

export type GridSnapshot = {
  width: number;
  height: number;
  terrain: CellTerrain[][];
  player: { x: number; y: number };
  blocks: Block[];
  playerText?: string;
  tigerText?: string;
  levelType?: 'tigerDoor' | 'fireWaterLove' | 'bioRepair';
  tigerPos?: { x: number; y: number } | null;
  firePos?: { x: number; y: number } | null;
  waterPos?: { x: number; y: number } | null;
};

export class GridModel {
  readonly width: number;
  readonly height: number;
  readonly terrain: CellTerrain[][];

  player = { x: 0, y: 0 };
  playerText = '人';
  private playerDefeated = false;
  private levelType: 'tigerDoor' | 'fireWaterLove' | 'bioRepair' = 'tigerDoor';
  private tigerText = '猛虎';
  private tigerPos: { x: number; y: number } | null = null;
  private tigerAlive = false;
  private seasonFruitMode = false;
  private seasonStage = 0;
  private firePos: { x: number; y: number } | null = null;
  private waterPos: { x: number; y: number } | null = null;
  private fireQuenchedCount = 0;
  private steamVisible = false;
  private steamAlpha = 1;
  private steamPos: { x: number; y: number } | null = null;
  private bioBarracksTriggered = false;

  private blockByPos = new Map<string, Block>();
  private nextBlockId = 1;

  constructor(snapshot: GridSnapshot) {
    this.width = snapshot.width;
    this.height = snapshot.height;
    this.terrain = snapshot.terrain;
    this.player = { ...snapshot.player };
    this.playerText = snapshot.playerText ?? '人';
    this.tigerText = snapshot.tigerText ?? '猛虎';
    this.levelType = snapshot.levelType ?? 'tigerDoor';
    this.tigerPos = snapshot.tigerPos ?? null;
    this.tigerAlive = !!snapshot.tigerPos;
    this.firePos = snapshot.firePos ?? null;
    this.waterPos = snapshot.waterPos ?? null;
    for (const b of snapshot.blocks) this.addBlock(b.text, b.x, b.y);
    this.seasonFruitMode =
      this.levelType === 'tigerDoor' &&
      !!this.tigerPos &&
      (this.hasBlockText('芽') || this.hasBlockText('小芽')) &&
      this.hasBlockText('春') &&
      this.hasBlockText('夏') &&
      this.hasBlockText('秋');
  }

  private key(x: number, y: number) {
    return `${x},${y}`;
  }

  /** 贴边定义：位于最外圈边界格 */
  private isEdgeCell(x: number, y: number) {
    return x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1;
  }

  /** 次外圈也算贴边：x<=1/x>=w-2 或 y<=1/y>=h-2 */
  private isNearEdgeCell(x: number, y: number) {
    return x <= 1 || y <= 1 || x >= this.width - 2 || y >= this.height - 2;
  }

  inBounds(x: number, y: number) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  isWall(x: number, y: number) {
    if (!this.inBounds(x, y)) return true;
    return this.terrain[y][x].wall;
  }

  isGoal(x: number, y: number) {
    if (!this.inBounds(x, y)) return false;
    return this.terrain[y][x].goal;
  }

  isDoor(x: number, y: number) {
    if (!this.inBounds(x, y)) return false;
    return this.terrain[y][x].door;
  }

  /** 本关是否存在“门通关”规则 */
  hasDoorWin(): boolean {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.terrain[y][x].door) return true;
      }
    }
    return false;
  }

  getBlockAt(x: number, y: number) {
    return this.blockByPos.get(this.key(x, y)) ?? null;
  }

  getBlocks(): Block[] {
    return [...this.blockByPos.values()].map((b) => ({ ...b }));
  }

  getPlayerText() {
    return this.playerText;
  }

  isPlayerDefeated() {
    return this.playerDefeated;
  }

  hasTigerAlive() {
    return this.tigerAlive;
  }

  getTigerPos() {
    return this.tigerPos ? { ...this.tigerPos } : null;
  }

  getTigerText() {
    return this.tigerText;
  }

  isSeasonFruitMode() {
    return this.seasonFruitMode;
  }

  getSeasonStage() {
    return this.seasonStage;
  }

  isBioRepairMode() {
    return this.levelType === 'bioRepair';
  }

  getBioRepairStage() {
    if (!this.isBioRepairMode()) return -1;
    const hasZombie = this.hasBlockText('丧尸');
    const hasBarracks = this.hasBlockText('兵营');
    const hasPurifier = this.hasBlockText('净化者');
    const hasRiver = this.hasBioRiverCell();
    if (hasZombie) return 0;
    if (hasBarracks && !this.bioBarracksTriggered) return 1;
    if (hasPurifier && hasRiver) return 2;
    return 3;
  }

  getFirePos() {
    return this.firePos ? { ...this.firePos } : null;
  }

  getWaterPos() {
    return this.waterPos ? { ...this.waterPos } : null;
  }

  hasSteam() {
    return this.steamVisible;
  }

  getSteamAlpha() {
    return this.steamAlpha;
  }

  getSteamPos() {
    return this.steamPos ? { ...this.steamPos } : null;
  }

  getFireHitCount() {
    return this.fireQuenchedCount;
  }

  hasCorpse() {
    return [...this.blockByPos.values()].some((b) => b.text === '尸体');
  }

  getCorpsePos() {
    const corpse = [...this.blockByPos.values()].find((b) => b.text === '尸体');
    return corpse ? { x: corpse.x, y: corpse.y } : null;
  }

  addBlock(text: string, x: number, y: number) {
    if (this.isEdgeCell(x, y)) {
      throw new Error(`Pushable block cannot be on edge: ${text} at (${x},${y})`);
    }
    if (text === '刀' && this.isNearEdgeCell(x, y)) {
      throw new Error(`Knife cannot be near edge: ${text} at (${x},${y})`);
    }
    const id = `B${this.nextBlockId++}`;
    const b: Block = { id, text, x, y };
    this.blockByPos.set(this.key(x, y), b);
    return b;
  }

  private moveBlock(block: Block, nx: number, ny: number) {
    this.blockByPos.delete(this.key(block.x, block.y));
    block.x = nx;
    block.y = ny;
    this.blockByPos.set(this.key(nx, ny), block);
  }

  private removeBlock(block: Block) {
    this.blockByPos.delete(this.key(block.x, block.y));
  }

  private hasBlockText(text: string) {
    return [...this.blockByPos.values()].some((b) => b.text === text);
  }

  private toInternalCoord(x: number, yBottomLeft: number) {
    return { x, y: this.height - 1 - yBottomLeft };
  }

  private toBottomY(yInternal: number) {
    return this.height - 1 - yInternal;
  }

  private getSmallSproutCoords() {
    const coordsBottom = [
      { x: 8, y: 1 },
      { x: 8, y: 2 },
      { x: 7, y: 3 }, { x: 8, y: 3 }, { x: 9, y: 3 },
      { x: 8, y: 4 },
      { x: 8, y: 5 },
    ];
    return coordsBottom.map((c) => this.toInternalCoord(c.x, c.y));
  }

  private getStageOneSproutCoords() {
    const coordsBottom = [
      { x: 8, y: 1 }, { x: 8, y: 2 },
      { x: 7, y: 3 }, { x: 8, y: 3 }, { x: 9, y: 3 },
      { x: 6, y: 4 }, { x: 7, y: 4 }, { x: 8, y: 4 }, { x: 9, y: 4 }, { x: 10, y: 4 },
      { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 },
      { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }, { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 },
      { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 8, y: 7 }, { x: 9, y: 7 }, { x: 10, y: 7 },
      { x: 7, y: 8 }, { x: 8, y: 8 }, { x: 9, y: 8 },
    ];
    return coordsBottom.map((c) => this.toInternalCoord(c.x, c.y));
  }

  /** 夏阶段大树占位（与关卡配置一致：左下角为原点），丫 占位即本集合 */
  private getSummerTreeCoordsBottom() {
    return [
      { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 }, { x: 8, y: 6 },
      { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 9, y: 1 },
      { x: 8, y: 7 },
      { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 8 }, { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 },
      { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 }, { x: 7, y: 9 }, { x: 8, y: 9 }, { x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 }, { x: 12, y: 9 },
      { x: 5, y: 10 }, { x: 6, y: 10 }, { x: 7, y: 10 }, { x: 8, y: 10 }, { x: 9, y: 10 }, { x: 10, y: 10 }, { x: 11, y: 10 },
      { x: 7, y: 11 }, { x: 8, y: 11 }, { x: 9, y: 11 },
    ];
  }

  private getSummerTreeCoords() {
    return this.getSummerTreeCoordsBottom().map((c) => this.toInternalCoord(c.x, c.y));
  }

  private syncSeasonShape(coords: { x: number; y: number }[]) {
    const keep = new Set(coords.map((c) => this.key(c.x, c.y)));
    for (const block of [...this.blockByPos.values()]) {
      if (block.text !== '芽' && block.text !== '小芽') continue;
      if (!keep.has(this.key(block.x, block.y))) {
        this.removeBlock(block);
      }
    }
    for (const c of coords) {
      const b = this.getBlockAt(c.x, c.y);
      if (!b) {
        this.addBlock('芽', c.x, c.y);
      } else if (b.text === '小芽') {
        b.text = '芽';
      }
    }
  }

  /**
   * 夏阶段大树：按格心坐标（左下角 y）区分 根 / 木 / 叶。
   * - 根：最底一行（树根）
   * - 木：主干竖列 x=8，y=2～7
   * - 叶：树冠及其余格
   */
  private growthTextByPos(x: number, y: number): string {
    const yb = this.toBottomY(y);
    if (yb === 1) return '根';
    if (x === 8 && yb >= 2 && yb <= 7) return '木';
    return '叶';
  }

  private growSeasonTreeFromYa() {
    // 夏阶段：先铺成你指定的大 footprint，再按规则标成根/木/叶。
    this.syncSeasonShape(this.getSummerTreeCoords());
    for (const block of this.blockByPos.values()) {
      if (block.text === '芽' || block.text === '小芽') {
        block.text = this.growthTextByPos(block.x, block.y);
      }
    }
  }

  private findNearbyAppleSpawn(cx: number, cy: number) {
    const maxD = Math.max(this.width, this.height);
    for (let d = 1; d <= maxD; d++) {
      for (let dx = -d; dx <= d; dx++) {
        const dy = d - Math.abs(dx);
        const candidates = dy === 0 ? [{ x: cx + dx, y: cy }] : [
          { x: cx + dx, y: cy + dy },
          { x: cx + dx, y: cy - dy },
        ];
        for (const p of candidates) {
          if (!this.inBounds(p.x, p.y)) continue;
          if (this.isNearEdgeCell(p.x, p.y)) continue;
          if (this.isWall(p.x, p.y) || this.isDoor(p.x, p.y)) continue;
          if (this.getBlockAt(p.x, p.y)) continue;
          if (this.isTigerAt(p.x, p.y) || this.isFireAt(p.x, p.y) || this.isWaterAt(p.x, p.y)) continue;
          if (this.player.x === p.x && this.player.y === p.y) continue;
          return p;
        }
      }
    }
    return null;
  }

  private canStandAt(x: number, y: number) {
    if (!this.inBounds(x, y)) return false;
    if (this.isWall(x, y) || this.isDoor(x, y)) return false;
    const block = this.getBlockAt(x, y);
    if (block && block.text !== '兵营') return false;
    if (this.isTigerAt(x, y) || this.isFireAt(x, y) || this.isWaterAt(x, y)) return false;
    return true;
  }

  private findSpawnCellsAround(cx: number, cy: number, count: number) {
    const picks: { x: number; y: number }[] = [];
    const seen = new Set<string>();
    const maxD = Math.max(this.width, this.height);
    for (let d = 1; d <= maxD && picks.length < count; d++) {
      for (let dx = -d; dx <= d && picks.length < count; dx++) {
        const dy = d - Math.abs(dx);
        const candidates = dy === 0
          ? [{ x: cx + dx, y: cy }]
          : [{ x: cx + dx, y: cy + dy }, { x: cx + dx, y: cy - dy }];
        for (const p of candidates) {
          const k = this.key(p.x, p.y);
          if (seen.has(k)) continue;
          seen.add(k);
          if (!this.inBounds(p.x, p.y) || this.isNearEdgeCell(p.x, p.y)) continue;
          if (!this.canStandAt(p.x, p.y)) continue;
          if (this.player.x === p.x && this.player.y === p.y) continue;
          picks.push(p);
          if (picks.length >= count) break;
        }
      }
    }
    return picks;
  }

  private isBioRiverText(text: string) {
    return text === '生' || text === '化' || text === '河' || text === '生化河';
  }

  private hasBioRiverCell() {
    return [...this.blockByPos.values()].some((b) => this.isBioRiverText(b.text));
  }

  private tryTriggerBioBarracksSpawn() {
    if (this.levelType !== 'bioRepair' || this.bioBarracksTriggered) return;
    const onCell = this.getBlockAt(this.player.x, this.player.y);
    if (!onCell || onCell.text !== '兵营') return;
    const picks = this.findSpawnCellsAround(onCell.x, onCell.y, 6);
    for (const p of picks) this.addBlock('净化者', p.x, p.y);
    this.bioBarracksTriggered = true;
    this.removeBlock(onCell);
  }

  private isGrowthTile(text: string) {
    return text === '小芽' || text === '芽' || text === '叶' || text === '木' || text === '根';
  }

  private isPlayerEnclosed() {
    const around = [
      { x: this.player.x, y: this.player.y - 1 },
      { x: this.player.x + 1, y: this.player.y },
      { x: this.player.x, y: this.player.y + 1 },
      { x: this.player.x - 1, y: this.player.y },
    ];
    return around.every((c) => !this.canStandAt(c.x, c.y));
  }

  private findBlockByText(text: string) {
    return [...this.blockByPos.values()].find((b) => b.text === text) ?? null;
  }

  private findNearestFreeAround(cx: number, cy: number) {
    const maxD = Math.max(this.width, this.height);
    for (let d = 1; d <= maxD; d++) {
      for (let dx = -d; dx <= d; dx++) {
        const dy = d - Math.abs(dx);
        const candidates = dy === 0 ? [{ x: cx + dx, y: cy }] : [
          { x: cx + dx, y: cy + dy },
          { x: cx + dx, y: cy - dy },
        ];
        for (const p of candidates) {
          if (this.canStandAt(p.x, p.y)) return p;
        }
      }
    }
    return null;
  }

  /** 夏阶段长成大树后：优先把玩家放到「秋」朝向树冠一侧（内部坐标南侧一格），避免困在树内 */
  private snapPlayerBehindAutumnAfterSummer() {
    const autumn = this.findBlockByText('秋');
    if (!autumn) return;
    const ax = autumn.x;
    const ay = autumn.y;
    const ordered = [
      { x: ax, y: ay + 1 },
      { x: ax + 1, y: ay },
      { x: ax - 1, y: ay },
      { x: ax, y: ay - 1 },
    ];
    for (const p of ordered) {
      if (this.canStandAt(p.x, p.y)) {
        this.player.x = p.x;
        this.player.y = p.y;
        return;
      }
    }
    const around = this.findNearestFreeAround(ax, ay);
    if (around) {
      this.player.x = around.x;
      this.player.y = around.y;
    }
  }

  private ejectPlayerFromGrowthIfNeeded() {
    const standingBlock = this.getBlockAt(this.player.x, this.player.y);
    if (!standingBlock && !this.isPlayerEnclosed()) return;

    // Priority: up -> right -> down -> left (visual space).
    const candidates = [
      { x: this.player.x, y: this.player.y - 1 },
      { x: this.player.x + 1, y: this.player.y },
      { x: this.player.x, y: this.player.y + 1 },
      { x: this.player.x - 1, y: this.player.y },
    ];
    for (const c of candidates) {
      if (!this.canStandAt(c.x, c.y)) continue;
      this.player.x = c.x;
      this.player.y = c.y;
      return;
    }

    // Fallback #1: above autumn.
    const autumn = this.findBlockByText('秋');
    if (autumn) {
      const aboveAutumn = { x: autumn.x, y: autumn.y - 1 };
      if (this.canStandAt(aboveAutumn.x, aboveAutumn.y)) {
        this.player.x = aboveAutumn.x;
        this.player.y = aboveAutumn.y;
        return;
      }
      // Fallback #2: nearest free around autumn.
      const aroundAutumn = this.findNearestFreeAround(autumn.x, autumn.y);
      if (aroundAutumn) {
        this.player.x = aroundAutumn.x;
        this.player.y = aroundAutumn.y;
        return;
      }
    }

    // Final fallback: remove one neighboring growth tile and stand there.
    const neighbors = [
      { x: this.player.x, y: this.player.y - 1 },
      { x: this.player.x + 1, y: this.player.y },
      { x: this.player.x, y: this.player.y + 1 },
      { x: this.player.x - 1, y: this.player.y },
    ];
    for (const n of neighbors) {
      const b = this.getBlockAt(n.x, n.y);
      if (!b || !this.isGrowthTile(b.text)) continue;
      this.removeBlock(b);
      if (this.canStandAt(n.x, n.y)) {
        this.player.x = n.x;
        this.player.y = n.y;
        return;
      }
    }
  }

  private trySeasonFruitTransform(source: Block, target: Block | null): boolean {
    if (!this.seasonFruitMode || !target) return false;
    if (this.seasonStage === 0 && source.text === '春' && target.text === '小芽') {
      const sx = source.x;
      const sy = source.y;
      this.removeBlock(source);
      target.text = '芽';
      this.syncSeasonShape(this.getStageOneSproutCoords());
      // 先站到推块格（春原格），再挤出；避免 tryMove 末尾再次覆盖坐标
      this.player.x = sx;
      this.player.y = sy;
      this.ejectPlayerFromGrowthIfNeeded();
      this.seasonStage = 1;
      return true;
    }
    if (this.seasonStage === 1 && source.text === '夏' && (target.text === '芽' || target.text === '小芽')) {
      this.removeBlock(source);
      this.growSeasonTreeFromYa();
      // 夏后落位由秋后吸附 + 挤出完成，不能被 tryMove 设回夏格覆盖
      this.snapPlayerBehindAutumnAfterSummer();
      this.ejectPlayerFromGrowthIfNeeded();
      this.seasonStage = 2;
      return true;
    }
    if (this.seasonStage === 2 && source.text === '秋' && target.text === '叶') {
      const sx = source.x;
      const sy = source.y;
      this.removeBlock(source);
      const spawn = this.findNearbyAppleSpawn(target.x, target.y);
      if (spawn) {
        this.addBlock('金苹果', spawn.x, spawn.y);
      } else {
        target.text = '金苹果';
      }
      this.player.x = sx;
      this.player.y = sy;
      this.ejectPlayerFromGrowthIfNeeded();
      this.seasonStage = 3;
      return true;
    }
    return false;
  }

  private isTigerAt(x: number, y: number) {
    return !!this.tigerPos && this.tigerAlive && this.tigerPos.x === x && this.tigerPos.y === y;
  }

  private isFireAt(x: number, y: number) {
    return !!this.firePos && this.firePos.x === x && this.firePos.y === y;
  }

  private isWaterAt(x: number, y: number) {
    return !!this.waterPos && this.waterPos.x === x && this.waterPos.y === y;
  }

  private trySpawnMiniBlocks(kind: '小火' | '小水', x: number, y: number, count: number) {
    const candidates: { x: number; y: number }[] = [];
    for (let ny = 0; ny < this.height; ny++) {
      for (let nx = 0; nx < this.width; nx++) {
        if (!this.inBounds(nx, ny) || this.isWall(nx, ny) || this.isDoor(nx, ny)) continue;
        if (this.getBlockAt(nx, ny)) continue;
        if (this.isFireAt(nx, ny) || this.isWaterAt(nx, ny) || this.isTigerAt(nx, ny)) continue;
        // 小水/小火散落生成：不贴边（最外圈+次外圈）
        if (this.isNearEdgeCell(nx, ny)) continue;
        // 避免紧贴触发点，强调“散落”
        if (Math.abs(nx - x) + Math.abs(ny - y) <= 1) continue;
        candidates.push({ x: nx, y: ny });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const pickCount = Math.min(count, candidates.length);
    for (let i = 0; i < pickCount; i++) {
      this.addBlock(kind, candidates[i].x, candidates[i].y);
    }
  }

  update(dt: number): boolean {
    if (!this.steamVisible) return false;
    const prev = this.steamAlpha;
    this.steamAlpha = Math.max(0, this.steamAlpha - dt * 0.35);
    if (this.steamAlpha <= 0) {
      this.steamVisible = false;
    }
    return this.steamAlpha !== prev;
  }

  tryMove(dir: Dir): boolean {
    if (this.playerDefeated) return false;

    const tx = this.player.x + dir.dx;
    const ty = this.player.y + dir.dy;

    if (this.isWall(tx, ty)) return false;

    if ((this.levelType === 'tigerDoor' || this.levelType === 'bioRepair') && this.isTigerAt(tx, ty)) {
      this.playerText = '小零食';
      this.playerDefeated = true;
      return true;
    }
    if (this.levelType === 'fireWaterLove' && this.isFireAt(tx, ty)) {
      this.playerText = '火蒸汽';
      this.playerDefeated = true;
      this.player.x = tx;
      this.player.y = ty;
      return true;
    }

    const block = this.getBlockAt(tx, ty);
    if (this.levelType === 'bioRepair' && block && block.text === '兵营') {
      this.player.x = tx;
      this.player.y = ty;
      this.tryTriggerBioBarracksSpawn();
      return true;
    }
    if (!block) {
      this.player.x = tx;
      this.player.y = ty;
      if (this.levelType === 'bioRepair') this.tryTriggerBioBarracksSpawn();
      return true;
    }

    const bx = tx + dir.dx;
    const by = ty + dir.dy;
    if (this.isWall(bx, by)) return false;
    if (this.isEdgeCell(bx, by)) return false;
    const targetBlock = this.getBlockAt(bx, by);
    if (this.levelType === 'bioRepair' && targetBlock) {
      if (block.text === '圣光' && this.isBioRiverText(targetBlock.text)) {
        this.removeBlock(block);
        this.removeBlock(targetBlock);
        this.player.x = tx;
        this.player.y = ty;
        return true;
      }
      if (block.text === '丧尸' && targetBlock.text === '医院') {
        this.removeBlock(block);
        targetBlock.text = '兵营';
        this.bioBarracksTriggered = false;
        this.player.x = tx;
        this.player.y = ty;
        return true;
      }
      if (block.text === '净化者' && this.isBioRiverText(targetBlock.text)) {
        this.removeBlock(block);
        targetBlock.text = '白河';
        this.player.x = tx;
        this.player.y = ty;
        return true;
      }
    }
    if (this.trySeasonFruitTransform(block, targetBlock)) {
      // 季节剧情已在 trySeasonFruitTransform 内设置玩家最终格，勿再写回 tx,ty（会覆盖秋后吸附）
      return true;
    }
    if (targetBlock) return false;

    if (this.levelType === 'tigerDoor' && this.isTigerAt(bx, by)) {
      if (block.text === '刀') {
        this.removeBlock(block);
        this.tigerAlive = false;
        this.addBlock('尸体', bx, by);
        this.player.x = tx;
        this.player.y = ty;
        return true;
      }
      if (this.seasonFruitMode && block.text === '金苹果' && this.seasonStage >= 3) {
        this.removeBlock(block);
        this.tigerAlive = false;
        this.addBlock('胖胖龙', bx, by);
        this.player.x = tx;
        this.player.y = ty;
        return true;
      }
      return false;
    }
    if (this.levelType === 'bioRepair' && this.isTigerAt(bx, by)) return false;

    if (this.levelType === 'fireWaterLove') {
      if (this.isFireAt(bx, by)) {
        if (block.text === '爱') {
          this.removeBlock(block);
          this.trySpawnMiniBlocks('小火', bx, by, 2);
          this.playerText = '化石';
          this.playerDefeated = true;
          this.player.x = tx;
          this.player.y = ty;
          return true;
        }
        if (block.text === '小水') {
          this.removeBlock(block);
          this.fireQuenchedCount++;
          if (this.fireQuenchedCount >= 2) {
            this.steamPos = this.firePos ? { ...this.firePos } : { x: bx, y: by };
            this.firePos = null;
            this.steamVisible = true;
            this.steamAlpha = 1;
          }
          this.player.x = tx;
          this.player.y = ty;
          return true;
        }
        return false;
      }
      if (this.isWaterAt(bx, by)) {
        if (block.text !== '爱') return false;
        this.removeBlock(block);
        this.trySpawnMiniBlocks('小水', bx, by, 2);
        this.player.x = tx;
        this.player.y = ty;
        return true;
      }
    }

    this.moveBlock(block, bx, by);
    this.player.x = tx;
    this.player.y = ty;
    if (this.levelType === 'bioRepair') this.tryTriggerBioBarracksSpawn();
    return true;
  }

  isWin(): boolean {
    if (this.hasDoorWin()) {
      if (this.levelType === 'fireWaterLove') {
        return !this.playerDefeated && this.fireQuenchedCount >= 2 && !this.hasSteam() && this.isDoor(this.player.x, this.player.y);
      }
      if (this.levelType === 'bioRepair') {
        return !this.playerDefeated && this.isDoor(this.player.x, this.player.y);
      }
      if (this.tigerPos) {
        return !this.tigerAlive && !this.playerDefeated && this.isDoor(this.player.x, this.player.y);
      }
      return this.isDoor(this.player.x, this.player.y);
    }
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!this.terrain[y][x].goal) continue;
        if (!this.getBlockAt(x, y)) return false;
      }
    }
    return true;
  }
}

