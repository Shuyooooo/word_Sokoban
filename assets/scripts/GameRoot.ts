import {
  _decorator,
  Camera,
  Canvas,
  Component,
  EventKeyboard,
  Input,
  JsonAsset,
  KeyCode,
  Layers,
  Node,
  Vec3,
  director,
  input,
  resources,
} from 'cc';
import { parseLevelFromConfig, type LevelConfig } from './LevelParser';
import { GridView } from './GridView';
import { InputController } from './InputController';
import { LevelRuntime } from './core/LevelRuntime';
import { HudController } from './ui/HudController';
import { StoryPanelController } from './ui/StoryPanelController';
import { CoverIntroController, showCoverTapToStart } from './ui/CoverIntroController';
import { DESKTOP_EDGE } from './ui/RetroDesktopBackground';
import { RetroGameShell } from './ui/RetroGameShell';
import type { GameEvent } from './core/GameEvent';

const { ccclass, property } = _decorator;

@ccclass('GameRoot')
export class GameRoot extends Component {
  @property
  cellSize = 64;

  @property(Node)
  boardRoot: Node | null = null;

  @property(Node)
  uiRoot: Node | null = null;

  private runtime: LevelRuntime | null = null;
  private view: GridView | null = null;
  private input: InputController | null = null;
  private hud: HudController | null = null;
  private storyPanel: StoryPanelController | null = null;
  private coverIntro: CoverIntroController | null = null;
  /** 封面流程异常时的全屏兜底节点 */
  private fallbackCoverNode: Node | null = null;
  private inCoverMode = true;
  private isBooting = false;
  private debugGridVisible = false;
  private levels: LevelConfig[] = [];
  private currentLevelIndex = 0;

  onLoad() {
    // 封面字体异步加载前会有一小段时间；先隐藏棋盘/UI，避免“像直接进关”。
    // 若脚本误挂在 BoardRoot 上，绝不能把自己 active 关掉，否则 GameRoot 不会运行。
    const boardRoot = this.boardRoot ?? this.node.getChildByName('BoardRoot');
    const uiRoot = this.uiRoot ?? this.node.getChildByName('UIRoot');
    if (boardRoot && boardRoot !== this.node) boardRoot.active = false;
    if (uiRoot && uiRoot !== this.node) uiRoot.active = false;
  }

  onEnable() {
    input.on(Input.EventType.KEY_DOWN, this.onGlobalKeyDown, this);

    this.inCoverMode = true;
    this.isBooting = false;

    this.ensureCameraSeesUi();

    // 延后一帧再播封面，避免场景/Canvas 尚未完全就绪时挂 UI 失败。
    this.scheduleOnce(() => {
      if (!this.isValid) return;
      const host = this.getCoverHostNode();
      this.coverIntro = new CoverIntroController(host);
            this.coverIntro
        .playCover({
          onStart: () => {
            this.inCoverMode = false;
            this.isBooting = true;
            (async () => {
              try {
                // 让“故事区”晚一点出现：先让推箱子区域可见
                await this.boot(this.currentLevelIndex, { delayStoryMs: 650 });
              } catch (err) {
                console.error('[GameRoot] boot failed:', err);
              } finally {
                this.isBooting = false;
              }
            })();
          },
        })
        .catch((err) => {
          console.error('[GameRoot] cover intro failed:', err);
          // 不要立刻 boot：否则你会感觉“没有开场”。改为全屏兜底，让用户点一下再进关。
          this.clearFallbackCover();
          this.fallbackCoverNode = showCoverTapToStart(host, () => {
            this.clearFallbackCover();
            this.inCoverMode = false;
            this.isBooting = true;
            (async () => {
              try {
                await this.boot(this.currentLevelIndex, { delayStoryMs: 0 });
              } catch (bootErr) {
                console.error('[GameRoot] boot failed:', bootErr);
              } finally {
                this.isBooting = false;
              }
            })();
          });
        });
    }, 0);
  }

  onDisable() {
    input.off(Input.EventType.KEY_DOWN, this.onGlobalKeyDown, this);
    this.input?.stop();
    this.input = null;
    this.coverIntro?.dispose();
    this.coverIntro = null;
    this.clearFallbackCover();
  }

  update(dt: number) {
    if (!this.runtime || !this.view) return;
    const events = this.runtime.tick(dt);
    if (events.length > 0) {
      this.applyEvents(events);
    }
  }

  private async boot(levelIndex: number, opts?: { delayStoryMs?: number }) {
    this.input?.stop();
    this.input = null;

    // 允许场景里没手动拖引用：按名字自动找，避免“什么都看不到”
    const boardRoot = this.boardRoot ?? this.node.getChildByName('BoardRoot');
    const uiRoot = this.uiRoot ?? this.node.getChildByName('UIRoot');
    if (!boardRoot || !uiRoot) return;
    this.boardRoot = boardRoot;
    this.uiRoot = uiRoot;
    boardRoot.active = true;
    uiRoot.active = true;
    RetroGameShell.ensure(this.node, boardRoot);

    if (!this.hud) {
      this.hud = new HudController(uiRoot);
      this.hud.init(() => {}, () => {}, () => {});
    }

    let storyRoot = this.node.getChildByName('StoryRoot');
    if (!storyRoot) {
      storyRoot = new Node('StoryRoot');
      storyRoot.layer = Layers.Enum.UI_2D;
      this.node.addChild(storyRoot);
    }
    storyRoot.setPosition(0, -220, 0);

    const delayStoryMs = Math.max(0, opts?.delayStoryMs ?? 0);
    if (delayStoryMs > 0) storyRoot.active = false;

    if (this.levels.length === 0) {
      const levelsJson = await this.loadLevelsConfig();
      this.levels = levelsJson.levels ?? [];
    }
    if (this.levels.length === 0) throw new Error('levels.json has no levels.');
    if (levelIndex < 0 || levelIndex >= this.levels.length) {
      throw new Error(`Level index out of range: ${levelIndex}`);
    }
    this.currentLevelIndex = levelIndex;
    const levelConfig = this.levels[this.currentLevelIndex];

    if (!this.storyPanel) {
      const sr = this.node.getChildByName('StoryRoot');
      if (sr) this.storyPanel = new StoryPanelController(sr);
    }

    const snapshot = parseLevelFromConfig(levelConfig);
    this.runtime = new LevelRuntime(snapshot);
    const activeCellSize = Number.isFinite(levelConfig.cellSize) ? Math.max(4, Math.floor(levelConfig.cellSize!)) : this.cellSize;

    this.ensureCameraSeesUi();

    // Board origin: center board in BoardRoot local space
    const boardOrigin = new Vec3(
      -((snapshot.width - 1) * activeCellSize) / 2,
      ((snapshot.height - 1) * activeCellSize) / 2,
      0
    );
    this.view = new GridView({ root: boardRoot, cellSize: activeCellSize, origin: boardOrigin });
    this.view.initFromSnapshot(this.runtime.getModel());
    this.debugGridVisible = false;
    this.view.setDebugGridVisible(false);

    this.input = new InputController((dir) => this.onMove(dir));
    this.input.start();

    // 延后故事区：先让推箱子区域出现，再显示“第一句话”
    if (delayStoryMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayStoryMs));
      if (storyRoot) storyRoot.active = true;
    }
    this.storyPanel?.beginLevel(levelConfig);
  }

  private setGameplayRootsActive(active: boolean) {
    const boardRoot = this.boardRoot ?? this.node.getChildByName('BoardRoot');
    const uiRoot = this.uiRoot ?? this.node.getChildByName('UIRoot');
    if (boardRoot) boardRoot.active = active;
    if (uiRoot) uiRoot.active = active;
  }

  /** 封面在 boot() 之前就会显示 UI，需要确保相机渲染 UI_2D。 */
  private ensureCameraSeesUi() {
    const host = this.getCoverHostNode();
    const cam = host.getChildByName('Camera')?.getComponent(Camera);
    if (cam) {
      cam.visibility = cam.visibility | Layers.Enum.UI_2D;
      cam.clearColor = DESKTOP_EDGE;
    }
  }

  /**
   * 封面必须挂在带 Canvas 的节点下（通常是 Canvas 根节点）。
   * 若 GameRoot 被挪到子节点，则向上找 Canvas；找不到再按场景名 `Canvas` 兜底。
   */
  private getCoverHostNode(): Node {
    if (this.node.getComponent(Canvas)) return this.node;
    let p: Node | null = this.node.parent;
    while (p) {
      if (p.getComponent(Canvas)) return p;
      p = p.parent;
    }
    const scene = director.getScene();
    const byName = scene?.getChildByName('Canvas');
    return byName ?? this.node;
  }

  private clearFallbackCover() {
    this.fallbackCoverNode?.destroy();
    this.fallbackCoverNode = null;
  }

  private async loadLevelsConfig(): Promise<{ levels: LevelConfig[] }> {
    return await new Promise((resolve, reject) => {
      resources.load('config/levels', JsonAsset, (err, asset) => {
        if (err || !asset) {
          reject(err ?? new Error('JsonAsset is null.'));
          return;
        }
        resolve(asset.json as { levels: LevelConfig[] });
      });
    });
  }

  private applyEvents(events: GameEvent[]) {
    if (!this.runtime || !this.view) return;
    this.view.applyEvents(events, this.runtime.getModel());
    this.storyPanel?.processEvents(events);
  }

  private onMove(dir: { dx: number; dy: number }) {
    if (!this.runtime) return;
    const events = this.runtime.move(dir);
    if (events.length === 1 && events[0].type === 'MoveBlocked') return;
    this.applyEvents(events);
  }

  private onGlobalKeyDown(e: EventKeyboard) {
    if (this.inCoverMode || this.isBooting) return;
    if (e.keyCode === KeyCode.KEY_R) {
      this.boot(this.currentLevelIndex).catch((err) => {
        console.error('[GameRoot] restart via key failed:', err);
      });
      return;
    }
    if (e.keyCode === KeyCode.KEY_N) {
      const nextIndex = this.currentLevelIndex + 1;
      if (nextIndex >= this.levels.length) {
        console.log('[GameRoot] 已是最后一关');
        return;
      }
      this.boot(nextIndex).catch((err) => {
        console.error('[GameRoot] next via key failed:', err);
      });
      return;
    }
    if (e.keyCode === KeyCode.KEY_D) {
      if (!this.view || !this.runtime) return;
      this.debugGridVisible = !this.debugGridVisible;
      this.view.setDebugGridVisible(this.debugGridVisible);
    }
  }
}
