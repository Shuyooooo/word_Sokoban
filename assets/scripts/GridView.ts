import {
  Layers,
  Color,
  Graphics,
  Label,
  Node,
  tween,
  TTFFont,
  UITransform,
  Vec3,
  _decorator,
} from 'cc';

import type { GridModel } from './GridModel';
import type { GameEvent } from './core/GameEvent';
import { NodeFactory } from './view/NodeFactory';
import { loadArkPixelFont } from './ui/ArkFont';

/** 棋盘内统一像素字号（方舟 12px 设计尺寸） */
const BOARD_FONT_SIZE = 12;
const BOARD_LINE_HEIGHT = 14;

const { ccclass } = _decorator;

type NodeBundle = {
  tiles: Node[][];
  player: Node;
  blocks: Map<string, Node>;
  tiger: Node | null;
  fire: Node | null;
  water: Node | null;
  steam: Node | null;
};

@ccclass('GridView')
export class GridView {
  private root: Node;
  private cellSize: number;
  private origin: Vec3;
  private showGridLines = false;
  private arkFont: TTFFont | null = null;

  private bundle: NodeBundle | null = null;

  constructor(opts: { root: Node; cellSize: number; origin?: Vec3 }) {
    this.root = opts.root;
    this.cellSize = opts.cellSize;
    this.origin = opts.origin ?? new Vec3(0, 0, 0);
  }

  private gridToPos(x: number, y: number) {
    return new Vec3(
      this.origin.x + x * this.cellSize,
      this.origin.y - y * this.cellSize,
      0
    );
  }

  private ensureUITransform(node: Node, w: number, h: number) {
    const ui = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    ui.setContentSize(w, h);
    ui.setAnchorPoint(0.5, 0.5);
    return ui;
  }

  private makeRectNode(name: string, w: number, h: number, color: Color) {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    this.ensureUITransform(n, w, h);
    const g = n.addComponent(Graphics);
    g.clear();
    g.fillColor = color;
    g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    return n;
  }

  /** 透明底 + 浅色描边，用于地板/墙格容器 */
  private makeTileFrameNode(name: string, w: number, h: number) {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    this.ensureUITransform(n, w, h);
    const g = n.addComponent(Graphics);
    this.drawTileFrame(g, w, h);
    return n;
  }

  private drawTileFrame(g: Graphics, w: number, h: number) {
    g.clear();
    g.fillColor = new Color(0, 0, 0, 0);
    g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    if (this.showGridLines) {
      g.strokeColor = new Color(188, 220, 255, 160);
      g.lineWidth = 1.5;
      g.rect(-w / 2, -h / 2, w, h);
      g.stroke();
    }
  }

  setDebugGridVisible(visible: boolean) {
    this.showGridLines = visible;
    this.refreshGridLines();
  }

  toggleDebugGridVisible(): boolean {
    this.showGridLines = !this.showGridLines;
    this.refreshGridLines();
    return this.showGridLines;
  }

  private refreshGridLines() {
    if (!this.bundle) return;
    for (const row of this.bundle.tiles) {
      for (const tile of row) {
        const g = tile.getComponent(Graphics);
        if (!g) continue;
        this.drawTileFrame(g, this.cellSize, this.cellSize);
      }
    }
  }

  private makeTextNode(name: string, w: number, h: number, text: string, color: Color, _extraSize = 0) {
    const created = NodeFactory.createLabelNode(name, text, w, h, BOARD_FONT_SIZE, color);
    created.label.overflow = Label.Overflow.SHRINK;
    created.label.enableWrapText = false;
    created.label.lineHeight = BOARD_LINE_HEIGHT;
    created.label.cacheMode = Label.CacheMode.BITMAP;
    const lb = created.label;
    if (this.arkFont) {
      lb.font = this.arkFont;
      lb.useSystemFont = false;
    }
    return created.node;
  }

  private applyBoardFontToLabel(lb: Label) {
    if (!this.arkFont) return;
    lb.font = this.arkFont;
    lb.useSystemFont = false;
    lb.fontSize = BOARD_FONT_SIZE;
    lb.lineHeight = BOARD_LINE_HEIGHT;
    lb.cacheMode = Label.CacheMode.BITMAP;
  }

  private walkLabels(node: Node, fn: (l: Label) => void) {
    const lb = node.getComponent(Label);
    if (lb) fn(lb);
    for (const c of node.children) {
      this.walkLabels(c, fn);
    }
  }

  private blockExtraSize(text: string) {
    if (text === '春' || text === '夏' || text === '秋' || text === '冬' || text === '叶' || text === '木' || text === '胖胖龙' || text === '白河' || text === '桥人') {
      return 1;
    }
    return 0;
  }

  private blockColor(text: string) {
    if (text === '生' || text === '化' || text === '河' || text === '生化河') {
      return new Color(220, 40, 40, 255);
    }
    return new Color(255, 255, 255, 255);
  }

  private createBlockNode(id: string, text: string) {
    const block = new Node(`Block_${id}`);
    block.layer = Layers.Enum.UI_2D;
    this.ensureUITransform(block, this.cellSize, this.cellSize);
    const displayText = text === '小火' ? '火' : text === '小水' ? '水' : text;
    const scale = text === '小火' || text === '小水' ? 0.6 : 0.85;
    const txt = this.makeTextNode(
      'BlockTxt',
      this.cellSize * scale,
      this.cellSize * scale,
      displayText,
      this.blockColor(text),
      this.blockExtraSize(displayText)
    );
    block.addChild(txt);
    const blockLb = txt.getComponent(Label);
    if (blockLb) this.applyBoardFontToLabel(blockLb);
    return block;
  }

  init(model: GridModel) {
    this.root.removeAllChildren();

    const tiles: Node[][] = [];
    const blocks = new Map<string, Node>();

    // Base tiles：透明底 + 描边；墙显示「墙」；门显示「门」
    for (let y = 0; y < model.height; y++) {
      const row: Node[] = [];
      for (let x = 0; x < model.width; x++) {
        const isWall = model.isWall(x, y);
        const isGoal = model.isGoal(x, y);
        const isDoor = model.isDoor(x, y);

        const tile = this.makeTileFrameNode(`Tile_${x}_${y}`, this.cellSize, this.cellSize);
        tile.setPosition(this.gridToPos(x, y));

        if (isWall) {
          const wallTxt = this.makeTextNode(
            `WallTxt_${x}_${y}`,
            this.cellSize,
            this.cellSize,
            '墙',
            new Color(160, 160, 160, 255)
          );
          wallTxt.setPosition(0, 0, 0);
          tile.addChild(wallTxt);
        } else if (isDoor) {
          const doorTxt = this.makeTextNode(
            `DoorTxt_${x}_${y}`,
            this.cellSize,
            this.cellSize,
            '门',
            new Color(148, 92, 48, 255)
          );
          doorTxt.setPosition(0, 0, 0);
          tile.addChild(doorTxt);
        } else if (isGoal) {
          const goal = this.makeRectNode(
            `Goal_${x}_${y}`,
            this.cellSize * 0.45,
            this.cellSize * 0.45,
            new Color(30, 140, 80, 90)
          );
          goal.setPosition(0, 0, 0);
          tile.addChild(goal);
        }

        this.root.addChild(tile);
        row.push(tile);
      }
      tiles.push(row);
    }

    // Player node
    const player = new Node('Player');
    player.layer = Layers.Enum.UI_2D;
    this.ensureUITransform(player, this.cellSize, this.cellSize);
    const playerTxt = this.makeTextNode(
      'PlayerTxt',
      this.cellSize * 0.85,
      this.cellSize * 0.85,
      model.getPlayerText(),
      new Color(255, 255, 255, 255)
    );
    player.addChild(playerTxt);
    this.root.addChild(player);

    // Blocks nodes
    for (const b of model.getBlocks()) {
      const block = this.createBlockNode(b.id, b.text);
      this.root.addChild(block);
      blocks.set(b.id, block);
    }

    const tigerPos = model.getTigerPos();
    let tiger: Node | null = null;
    let fire: Node | null = null;
    let water: Node | null = null;
    let steam: Node | null = null;
    if (tigerPos) {
      const tigerText = model.getTigerText();
      const tigerExtraSize = tigerText === '巨龙' || tigerText === '生化河' ? 1 : 0;
      tiger = this.makeTextNode('Tiger', this.cellSize, this.cellSize, tigerText, new Color(220, 40, 40, 255), tigerExtraSize);
      tiger.setPosition(this.gridToPos(tigerPos.x, tigerPos.y));
      this.root.addChild(tiger);
    }
    const firePos = model.getFirePos();
    if (firePos) {
      fire = this.makeTextNode('Fire', this.cellSize, this.cellSize, '火', new Color(255, 77, 61, 255));
      fire.setPosition(this.gridToPos(firePos.x, firePos.y));
      this.root.addChild(fire);
    }
    const waterPos = model.getWaterPos();
    if (waterPos) {
      water = this.makeTextNode('Water', this.cellSize, this.cellSize, '水', new Color(127, 211, 255, 255));
      water.setPosition(this.gridToPos(waterPos.x, waterPos.y));
      this.root.addChild(water);
    }
    steam = this.makeTextNode('Steam', this.cellSize * 1.6, this.cellSize, '水蒸汽', new Color(255, 255, 255, 255));
    steam.active = false;
    this.root.addChild(steam);

    this.bundle = { tiles, player, blocks, tiger, fire, water, steam };
    this.refreshGridLines();
    this.sync(model);

    loadArkPixelFont((font) => {
      this.arkFont = font;
      if (!font) {
        console.warn('[GridView] 方舟字体未加载，棋盘区使用系统字（请将 ttf 放在 assets/resources/fonts/）');
        return;
      }
      this.walkLabels(this.root, (lb) => this.applyBoardFontToLabel(lb));
    });
  }

  initFromSnapshot(model: GridModel) {
    this.init(model);
  }

  sync(model: GridModel) {
    if (!this.bundle) return;

    const playerTarget = this.gridToPos(model.player.x, model.player.y);
    tween(this.bundle.player).stop();
    tween(this.bundle.player).to(0.08, { position: playerTarget }).start();
    const playerTxt = this.bundle.player.getChildByName('PlayerTxt')?.getComponent(Label);
    if (playerTxt) {
      playerTxt.string = model.getPlayerText();
      playerTxt.color = model.isPlayerDefeated()
        ? new Color(255, 160, 160, 255)
        : new Color(255, 255, 255, 255);
    }

    const blocks = model.getBlocks();
    const latestIds = new Set(blocks.map((b) => b.id));
    for (const [id, node] of this.bundle.blocks) {
      if (latestIds.has(id)) continue;
      node.removeFromParent();
      this.bundle.blocks.delete(id);
    }
    for (const b of blocks) {
      let n = this.bundle.blocks.get(b.id);
      if (!n) {
        n = this.createBlockNode(b.id, b.text);
        this.root.addChild(n);
        this.bundle.blocks.set(b.id, n);
      }
      const target = this.gridToPos(b.x, b.y);
      tween(n).stop();
      tween(n).to(0.08, { position: target }).start();

      const txt = n.getChildByName('BlockTxt')?.getComponent(Label);
      if (txt) {
        const display = b.text === '小火' ? '火' : b.text === '小水' ? '水' : b.text;
        txt.string = display;
        txt.color = this.blockColor(b.text);
      }
    }

    if (this.bundle.tiger) {
      this.bundle.tiger.active = model.hasTigerAlive();
    }
    if (this.bundle.fire) {
      const firePos = model.getFirePos();
      this.bundle.fire.active = !!firePos;
      if (firePos) {
        this.bundle.fire.setPosition(this.gridToPos(firePos.x, firePos.y));
        const hitCount = model.getFireHitCount();
        const scale = hitCount <= 0 ? 1 : hitCount === 1 ? 0.75 : 0.55;
        this.bundle.fire.setScale(scale, scale, 1);
      }
    }
    if (this.bundle.water) {
      const waterPos = model.getWaterPos();
      this.bundle.water.active = !!waterPos;
      if (waterPos) this.bundle.water.setPosition(this.gridToPos(waterPos.x, waterPos.y));
    }
    if (this.bundle.steam) {
      const steamPos = model.getSteamPos();
      this.bundle.steam.active = model.hasSteam() && !!steamPos;
      if (this.bundle.steam.active && steamPos) {
        this.bundle.steam.setPosition(this.gridToPos(steamPos.x, steamPos.y));
        const txt = this.bundle.steam.getComponent(Label);
        if (txt) {
          txt.color = new Color(255, 255, 255, Math.floor(255 * model.getSteamAlpha()));
        }
      }
    }
  }

  applyEvents(_events: GameEvent[], model: GridModel) {
    // Current refactor stage: event bus is wired, while view update
    // remains state-driven for behavior stability.
    this.sync(model);
  }
}

