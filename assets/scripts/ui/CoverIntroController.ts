import { Color, Graphics, Label, LabelOutline, Layers, Node, tween, UITransform, UIOpacity, TTFFont } from 'cc';
import { loadArkPixelFont } from './ArkFont';
import { createFullScreenRetroBackdropNode, DESKTOP_FADE_SOLID, fillRetroDesktopGraphics } from './RetroDesktopBackground';

const DESIGN_W = 1280;
const DESIGN_H = 720;

// 注意：cc.Color 的 alpha 是 0~255，不是 0~100。写 100 会变成约 39% 透明度，整字可能发灰。
/** 推：粉紫霓虹双层描边；空心填充（alpha=0 避免发灰） */
const COLOR_PUSH_FILL = new Color(255, 255, 255, 180);
const COLOR_PUSH_OUTLINE_GLOW = new Color(0, 95, 210, 100);
const COLOR_PUSH_OUTLINE_CORE = new Color(185, 255, 248, 255);
const COLOR_WHITE = new Color(255, 255, 255, 255);

type PlayOpts = {
  onStart: () => void;
};

/**
 * 封面主流程失败时的兜底：全屏暗色 + 提示文字，点击后进入关卡。
 * 返回根节点，便于 GameRoot 在 onDisable 时销毁。
 */
export function showCoverTapToStart(host: Node, onStart: () => void): Node {
  const overlay = new Node('CoverTapToStart');
  overlay.layer = Layers.Enum.UI_2D;
  const ui = overlay.addComponent(UITransform);
  ui.setContentSize(DESIGN_W, DESIGN_H);
  ui.setAnchorPoint(0.5, 0.5);
  overlay.setPosition(0, 0, 0);
  host.addChild(overlay);
  overlay.setSiblingIndex(Math.max(0, host.children.length - 1));

  const g = overlay.addComponent(Graphics);
  fillRetroDesktopGraphics(g, DESIGN_W, DESIGN_H, 0x7a1b0d);

  const tip = new Node('TapTip');
  tip.layer = Layers.Enum.UI_2D;
  const tui = tip.addComponent(UITransform);
  tui.setContentSize(DESIGN_W, 120);
  tui.setAnchorPoint(0.5, 0.5);
  tip.setPosition(0, 0, 0);
  overlay.addChild(tip);

  const lb = tip.addComponent(Label);
  lb.string = '封面加载失败：点击屏幕开始';
  lb.fontSize = 22;
  lb.lineHeight = 26;
  lb.horizontalAlign = Label.HorizontalAlign.CENTER;
  lb.verticalAlign = Label.VerticalAlign.CENTER;
  lb.color = new Color(255, 255, 255, 255);
  lb.cacheMode = Label.CacheMode.NONE;

  const handler = () => {
    overlay.off(Node.EventType.TOUCH_END, handler);
    overlay.off(Node.EventType.MOUSE_UP, handler);
    onStart();
    overlay.destroy();
  };
  overlay.on(Node.EventType.TOUCH_END, handler);
  overlay.on(Node.EventType.MOUSE_UP, handler);

  return overlay;
}

export class CoverIntroController {
  private root: Node;
  private overlayRoot: Node | null = null;
  private fadeMaskOpacity: UIOpacity | null = null;
  private startBtnNode: Node | null = null;
  private isStarting = false;

  constructor(root: Node) {
    this.root = root;
  }

  dispose() {
    this.overlayRoot?.destroy();
    this.overlayRoot = null;
    this.fadeMaskOpacity = null;
    this.startBtnNode = null;
    this.isStarting = false;
  }

  async playCover(opts: PlayOpts) {
    this.dispose();

    this.isStarting = false;

    // Overlay root (UI layer)
    const overlay = new Node('CoverIntroRoot');
    overlay.layer = Layers.Enum.UI_2D;
    const overlayUI = overlay.addComponent(UITransform);
    overlayUI.setContentSize(DESIGN_W, DESIGN_H);
    overlayUI.setAnchorPoint(0.5, 0.5);
    overlay.setPosition(0, 0, 0);
    this.root.addChild(overlay);
    this.overlayRoot = overlay;
    overlay.setSiblingIndex(Math.max(0, this.root.children.length - 1));

    // Title container
    const title = new Node('Title');
    title.layer = Layers.Enum.UI_2D;
    overlay.addChild(title);

    // 一行「推 箱子」：推在左，箱→子在中右；动画顺序为 箱→子→推（推最后出现）
    const titleY = 60;
    const gapAfterPush = 14;
    // makeCharNode 的宽度近似逻辑也用这里，保证排布不裁切
    const charWidth = (fontSize: number, text: string) => Math.max(10, fontSize * 1.1 * Math.max(1, text.length * 0.95));
    const pushText = '推';
    const boxCharText = '箱';
    const childCharText = '子';
    const pushW = charWidth(24, pushText);
    const boxW = charWidth(18, boxCharText);
    const childW = charWidth(18, childCharText);

    const totalW = pushW + gapAfterPush + boxW + childW;
    const pushX = -totalW / 2 + pushW / 2;
    const boxX = pushX + pushW / 2 + gapAfterPush + boxW / 2;
    const childX = boxX + boxW / 2 + childW / 2;

    // --- "箱" (pixel white) ---
    const box = this.makeCharNode({
      name: 'BoxChar',
      text: boxCharText,
      fontSize: 18,
      color: new Color(COLOR_WHITE.r, COLOR_WHITE.g, COLOR_WHITE.b, 255),
      font: null,
    });
    box.setPosition(boxX, titleY, 0);
    box.active = true;
    title.addChild(box);

    // --- "子" (pixel white) ---
    const child = this.makeCharNode({
      name: 'ChildChar',
      text: childCharText,
      fontSize: 18,
      color: new Color(COLOR_WHITE.r, COLOR_WHITE.g, COLOR_WHITE.b, 255),
      font: null,
    });
    child.setPosition(childX, titleY, 0);
    child.active = true;
    title.addChild(child);

    // --- "推" (青霓虹双层描边空心，最后淡入) ---
    const push = this.makePushNeonCharNode({
      text: pushText,
      fontSize: 24,
      skewX: -18,
    });
    push.setPosition(pushX, titleY, 0);
    push.active = true;
    title.addChild(push);

    // Initial: 箱/子/推 隐藏
    const boxOpacity = box.getComponent(UIOpacity);
    const childOpacity = child.getComponent(UIOpacity);
    const pushOpacity = push.getComponent(UIOpacity);
    if (boxOpacity) boxOpacity.opacity = 0;
    if (childOpacity) childOpacity.opacity = 0;
    if (pushOpacity) pushOpacity.opacity = 0;

    // --- Fullscreen black fade mask (opacity tween) ---
    const fadeMask = new Node('CoverFadeMask');
    fadeMask.layer = Layers.Enum.UI_2D;
    const fadeUI = fadeMask.addComponent(UITransform);
    fadeUI.setContentSize(DESIGN_W, DESIGN_H);
    fadeUI.setAnchorPoint(0.5, 0.5);
    fadeMask.setPosition(0, 0, 0);
    const g = fadeMask.addComponent(Graphics);
    g.clear();
    g.fillColor = DESKTOP_FADE_SOLID;
    g.rect(-DESIGN_W / 2, -DESIGN_H / 2, DESIGN_W, DESIGN_H);
    g.fill();

    const fadeOp = fadeMask.addComponent(UIOpacity);
    fadeOp.opacity = 0;
    this.fadeMaskOpacity = fadeOp;
    overlay.addChild(fadeMask);
    fadeMask.setSiblingIndex(0);

    const backdrop = createFullScreenRetroBackdropNode('CoverBackdrop', DESIGN_W, DESIGN_H, 0x50c0babe);
    overlay.addChild(backdrop);
    backdrop.setSiblingIndex(0);

    loadArkPixelFont((font) => {
      if (!font || !this.overlayRoot) return;
      try {
        this.applyFontToLabels(this.overlayRoot, font);
      } catch (e) {
        console.warn('[CoverIntro] apply font failed:', e);
      }
    });

    // --- Animate：推 → 箱 → 子 ---
    await this.revealOpacity(pushOpacity, 0, 255, 180);
    await this.revealOpacity(boxOpacity, 0, 255, 160);
    await this.revealOpacity(childOpacity, 0, 255, 160);

    // stay 2 seconds
    await this.sleep(2000);

    // fade to black
    await this.revealOpacity(fadeOp, 0, 255, 600);

    // “开始”出现后不隐藏标题，避免视觉上变成第二屏

    // 小号青绿霓虹「开始」按钮（叠在黑遮罩之上）
    const startBtn = this.makeNeonStartButton(null);
    // 根据蓝框调整：按钮整体下移，避免与其他 UI 重叠
    startBtn.setPosition(0, -120);
    startBtn.active = true;
    overlay.addChild(startBtn);
    startBtn.setSiblingIndex(Math.max(0, overlay.children.length - 1));
    this.startBtnNode = startBtn;

    const startOpacity = startBtn.getComponent(UIOpacity);
    if (startOpacity) startOpacity.opacity = 0;
    await this.revealOpacity(startOpacity, 0, 255, 220);

    const cb = () => this.onStartClicked(opts.onStart);
    const onceHandler = () => {
      startBtn.off(Node.EventType.TOUCH_END, onceHandler);
      startBtn.off(Node.EventType.MOUSE_UP, onceHandler);
      cb();
    };
    startBtn.on(Node.EventType.TOUCH_END, onceHandler);
    startBtn.on(Node.EventType.MOUSE_UP, onceHandler);
  }

  private onStartClicked(onStart: () => void) {
    if (this.isStarting) return;
    this.isStarting = true;
    if (!this.fadeMaskOpacity || !this.overlayRoot) {
      onStart();
      return;
    }

    // Fade black -> transparent, then boot gameplay behind it
    const dur = 650;
    const fadeOp = this.fadeMaskOpacity;

    onStart();

    tween(fadeOp)
      .to(dur / 1000, { opacity: 0 })
      .call(() => {
        this.dispose();
      })
      .start();

    // 兜底：避免 .call 不触发导致封面层残留。
    setTimeout(() => {
      this.dispose();
    }, dur);
  }

  private makeCharNode(opts: {
    name: string;
    text: string;
    fontSize: number;
    color: Color;
    outlineColor?: Color;
    outlineWidth?: number;
    italicSkewX?: number;
    font?: TTFFont | null;
  }) {
    const node = new Node(opts.name);
    node.layer = Layers.Enum.UI_2D;
    const ui = node.addComponent(UITransform);

    // Fixed content size for consistent positioning.
    // 注意：“箱子”等多字时需要更宽，否则 Label 可能裁切，影响描边显示。
    const w = Math.max(10, opts.fontSize * 1.1 * Math.max(1, opts.text.length * 0.95));
    const h = Math.max(10, opts.fontSize * 1.3);
    ui.setContentSize(w, h);
    ui.setAnchorPoint(0.5, 0.5);

    const lb = node.addComponent(Label);
    lb.string = opts.text;
    lb.fontSize = opts.fontSize;
    lb.lineHeight = Math.floor(opts.fontSize * 1.2);
    lb.horizontalAlign = Label.HorizontalAlign.CENTER;
    lb.verticalAlign = Label.VerticalAlign.CENTER;
    lb.color = opts.color;
    // 封面用 NONE 更稳：BITMAP + UIOpacity 在部分机型/预览上可能不刷新。
    lb.cacheMode = Label.CacheMode.NONE;
    if (opts.font) {
      lb.font = opts.font;
      lb.useSystemFont = false;
    }

    if (opts.outlineColor) {
      const o = node.addComponent(LabelOutline);
      o.color = opts.outlineColor;
      o.width = opts.outlineWidth ?? 2;
    }

    const op = node.addComponent(UIOpacity);
    op.opacity = 255;

    if (typeof opts.italicSkewX === 'number') {
      try {
        (node as any).skewX = opts.italicSkewX;
      } catch {
        // 个别平台不支持 skew，忽略即可
      }
    }

    return node;
  }

  /** 「推」：外层宽描边柔光 + 内层亮边，与第二屏「开始」霓虹同色系 */
  private makePushNeonCharNode(opts: { text: string; fontSize: number; skewX: number }) {
    const root = new Node('PushChar');
    root.layer = Layers.Enum.UI_2D;
    const ui = root.addComponent(UITransform);
    const w = Math.max(10, opts.fontSize * 1.1 * Math.max(1, opts.text.length * 0.95));
    const h = Math.max(10, opts.fontSize * 1.3);
    ui.setContentSize(w, h);
    ui.setAnchorPoint(0.5, 0.5);

    try {
      (root as any).skewX = opts.skewX;
    } catch {
      // 个别平台不支持 skew，忽略即可
    }

    const addLayer = (name: string, outlineColor: Color, outlineWidth: number) => {
      const n = new Node(name);
      n.layer = Layers.Enum.UI_2D;
      const u = n.addComponent(UITransform);
      u.setContentSize(w, h);
      u.setAnchorPoint(0.5, 0.5);
      n.setPosition(0, 0, 0);
      const lb = n.addComponent(Label);
      lb.string = opts.text;
      lb.fontSize = opts.fontSize;
      lb.lineHeight = Math.floor(opts.fontSize * 1.2);
      lb.horizontalAlign = Label.HorizontalAlign.CENTER;
      lb.verticalAlign = Label.VerticalAlign.CENTER;
      lb.color = COLOR_PUSH_FILL;
      lb.cacheMode = Label.CacheMode.NONE;
      const o = n.addComponent(LabelOutline);
      o.color = outlineColor;
      o.width = outlineWidth;
      root.addChild(n);
    };

    addLayer('PushGlow', COLOR_PUSH_OUTLINE_GLOW, 5);
    addLayer('PushCore', COLOR_PUSH_OUTLINE_CORE, 2);

    const op = root.addComponent(UIOpacity);
    op.opacity = 255;
    return root;
  }

  private async revealOpacity(op: UIOpacity | null | undefined, from: number, to: number, durMs: number) {
    if (!op) return;
    op.opacity = from;
    try {
      tween(op).to(durMs / 1000, { opacity: to }).start();
    } catch (e) {
      console.warn('[CoverIntro] tween opacity failed, set directly:', e);
      op.opacity = to;
    }
    return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, durMs)));
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  /** 第二屏：小号圆角框 + 青绿霓虹描边（多层 Graphics stroke 模拟外发光） */
  private makeNeonStartButton(font: TTFFont | null) {
    const btn = new Node('NeonStartButton');
    btn.layer = Layers.Enum.UI_2D;

    const w = 176;
    const h = 48;
    const r = 12;
    const ui = btn.addComponent(UITransform);
    ui.setContentSize(w, h);
    ui.setAnchorPoint(0.5, 0.5);

    const g = btn.addComponent(Graphics);
    g.clear();
    const x0 = -w / 2;
    const y0 = -h / 2;
    // 外圈光晕 → 内圈亮边
    g.strokeColor = new Color(0, 255, 210, 45);
    g.lineWidth = 4;
    g.roundRect(x0, y0, w, h, r);
    g.stroke();
    g.strokeColor = new Color(40, 255, 220, 110);
    g.lineWidth = 2;
    g.roundRect(x0, y0, w, h, r);
    g.stroke();
    g.strokeColor = new Color(180, 255, 245, 255);
    g.lineWidth = 1;
    g.roundRect(x0, y0, w, h, r);
    g.stroke();

    const labelNode = new Node('StartText');
    labelNode.layer = Layers.Enum.UI_2D;
    const lUI = labelNode.addComponent(UITransform);
    lUI.setContentSize(w, h);
    lUI.setAnchorPoint(0.5, 0.5);
    labelNode.setPosition(0, 0, 0);
    btn.addChild(labelNode);

    const lb = labelNode.addComponent(Label);
    lb.string = '开始';
    lb.fontSize = 22;
    lb.lineHeight = 26;
    lb.horizontalAlign = Label.HorizontalAlign.CENTER;
    lb.verticalAlign = Label.VerticalAlign.CENTER;
    lb.color = new Color(200, 255, 248, 255);
    lb.cacheMode = Label.CacheMode.NONE;
    const lo = labelNode.addComponent(LabelOutline);
    lo.color = new Color(0, 255, 200, 160);
    lo.width = 1;
    if (font) {
      lb.font = font;
      lb.useSystemFont = false;
    }

    const op = btn.addComponent(UIOpacity);
    op.opacity = 0;
    return btn;
  }

  private applyFontToLabels(root: Node, font: TTFFont) {
    const walk = (n: Node) => {
      const lb = n.getComponent(Label);
      if (lb) {
        lb.font = font;
        lb.useSystemFont = false;
        lb.cacheMode = Label.CacheMode.NONE;
      }
      for (const c of n.children) walk(c);
    };
    walk(root);
  }
}

