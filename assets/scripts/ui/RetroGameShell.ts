import { Color, Graphics, Label, LabelOutline, Layers, Node, UITransform, TTFFont } from 'cc';
import { loadArkPixelFont } from './ArkFont';
import { fillPanelInnerGraphics, fillRetroDesktopGraphics } from './RetroDesktopBackground';

const DESIGN_W = 1280;
const DESIGN_H = 720;

const CYAN = new Color(0, 255, 240, 255);
const CYAN_DIM = new Color(0, 220, 255, 200);
const MAGENTA = new Color(255, 0, 220, 255);
const MAGENTA_GLOW = new Color(255, 40, 240, 90);
/** 窗格内底：冷紫灰、半透明以透出背后径向桌面 */
const PANEL_BG = new Color(14, 10, 28, 158);
const TOP_LINE_Y_OFFSET = 30;
const TOP_TEXT_Y_OFFSET = 16;
// 按示意图：粉紫框接近全宽，且高度覆盖到中下区域
const CENTER_PANEL_W = 1240;
const CENTER_PANEL_H = 350;
const CENTER_PANEL_Y = 130;
const CONTENT_HOST_W = 300;
const CONTENT_HOST_H = 320;
const CONTENT_HOST_Y = -10;

/**
 * 复古「系统桌面」外壳：顶栏蓝线 + 功能键文案 + 中央紫框游戏窗，棋盘挂在 ContentHost 下。
 */
export class RetroGameShell {
  static ensure(canvas: Node, boardRoot: Node): void {
    let shell = canvas.getChildByName('RetroGameShell');
    if (!shell) {
      shell = this.build(canvas);
      const camIdx = canvas.children.findIndex((c) => c.name === 'Camera');
      shell.setSiblingIndex(camIdx >= 0 ? camIdx + 1 : 0);
    }

    const content =
      shell.getChildByName('CenterPanel')?.getChildByName('InnerFill')?.getChildByName('ContentHost') ?? null;
    if (!content) return;

    if (boardRoot.parent !== content) {
      boardRoot.removeFromParent();
      content.addChild(boardRoot);
    }
    boardRoot.setPosition(0, 0, 0);
  }

  private static build(canvas: Node): Node {
    const shell = new Node('RetroGameShell');
    shell.layer = Layers.Enum.UI_2D;
    const shellUi = shell.addComponent(UITransform);
    shellUi.setContentSize(DESIGN_W, DESIGN_H);
    shellUi.setAnchorPoint(0.5, 0.5);
    shell.setPosition(0, 0, 0);
    canvas.addChild(shell);

    // 深色底（略偏紫）
    const bg = new Node('DesktopBg');
    bg.layer = Layers.Enum.UI_2D;
    const bgUi = bg.addComponent(UITransform);
    bgUi.setContentSize(DESIGN_W, DESIGN_H);
    bgUi.setAnchorPoint(0.5, 0.5);
    const bgG = bg.addComponent(Graphics);
    fillRetroDesktopGraphics(bgG, DESIGN_W, DESIGN_H, 0x7e11c0de);
    shell.addChild(bg);

    this.buildTopBar(shell);
    this.buildCenterPanel(shell);

    return shell;
  }

  private static buildTopBar(parent: Node): void {
    const barH = 64;
    const topBar = new Node('TopBar');
    topBar.layer = Layers.Enum.UI_2D;
    const ui = topBar.addComponent(UITransform);
    ui.setContentSize(DESIGN_W, barH);
    ui.setAnchorPoint(0.5, 1);
    topBar.setPosition(0, DESIGN_H / 2, 0);
    parent.addChild(topBar);

    const line = new Node('TopLine');
    line.layer = Layers.Enum.UI_2D;
    const lineUi = line.addComponent(UITransform);
    lineUi.setContentSize(DESIGN_W, 3);
    lineUi.setAnchorPoint(0.5, 0);
    // 顶部青线上移一些（更贴近顶部）
    line.setPosition(0, -barH + TOP_LINE_Y_OFFSET, 0);
    const lg = line.addComponent(Graphics);
    lg.clear();
    lg.fillColor = new Color(0, 255, 255, 255);
    lg.rect(-DESIGN_W / 2, -1.5, DESIGN_W, 3);
    lg.fill();
    topBar.addChild(line);

    const left = this.makeBarLabel('BtnLeft', '功能按钮1', 280, barH - 8, Label.HorizontalAlign.LEFT);
    left.setPosition(-DESIGN_W / 2 + 24 + 140, -barH / 2 + TOP_TEXT_Y_OFFSET, 0);
    topBar.addChild(left);

    const center = this.makeBarLabel('ChapterTitle', '章节1-1', 520, barH - 8, Label.HorizontalAlign.CENTER);
    center.setPosition(0, -barH / 2 + TOP_TEXT_Y_OFFSET, 0);
    const cl = center.getComponent(Label);
    if (cl) {
      cl.fontSize = 26;
      cl.lineHeight = 30;
      cl.color = CYAN;
    }
    topBar.addChild(center);

    const right = this.makeBarLabel('BtnRight', '功能按钮2', 280, barH - 8, Label.HorizontalAlign.RIGHT);
    right.setPosition(DESIGN_W / 2 - 24 - 140, -barH / 2 + TOP_TEXT_Y_OFFSET, 0);
    topBar.addChild(right);

    // 顶部文字统一像素字体（方舟）+ 霓虹描边风格
    loadArkPixelFont((font) => {
      if (!font) return;
      this.applyTopLabelFont(left, font);
      this.applyTopLabelFont(center, font);
      this.applyTopLabelFont(right, font);
    });
  }

  private static makeBarLabel(name: string, text: string, w: number, h: number, align: number): Node {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    const u = n.addComponent(UITransform);
    u.setContentSize(w, h);
    u.setAnchorPoint(0.5, 0.5);
    const lb = n.addComponent(Label);
    lb.string = text;
    lb.fontSize = 20;
    lb.lineHeight = 24;
    lb.horizontalAlign = align;
    lb.verticalAlign = Label.VerticalAlign.CENTER;
    lb.color = CYAN_DIM;
    lb.cacheMode = Label.CacheMode.NONE;
    const outline = n.addComponent(LabelOutline);
    outline.color = new Color(0, 255, 255, 120);
    outline.width = 1;
    return n;
  }

  private static applyTopLabelFont(labelNode: Node, font: TTFFont): void {
    const lb = labelNode.getComponent(Label);
    if (!lb) return;
    lb.font = font;
    lb.useSystemFont = false;
    lb.cacheMode = Label.CacheMode.NONE;
  }

  private static buildCenterPanel(parent: Node): Node {
    const panelW = CENTER_PANEL_W;
    const panelH = CENTER_PANEL_H;
    const borderInset = 10;
    const headerH = 40;

    const center = new Node('CenterPanel');
    center.layer = Layers.Enum.UI_2D;
    const ui = center.addComponent(UITransform);
    ui.setContentSize(panelW, panelH);
    ui.setAnchorPoint(0.5, 0.5);
    center.setPosition(0, CENTER_PANEL_Y, 0);

    // 外发光 + 实线边框（直角）
    const frame = new Node('FrameStroke');
    frame.layer = Layers.Enum.UI_2D;
    const fui = frame.addComponent(UITransform);
    fui.setContentSize(panelW, panelH);
    fui.setAnchorPoint(0.5, 0.5);
    const fg = frame.addComponent(Graphics);
    fg.clear();
    const x0 = -panelW / 2;
    const y0 = -panelH / 2;
    fg.strokeColor = MAGENTA_GLOW;
    fg.lineWidth = 10;
    fg.rect(x0, y0, panelW, panelH);
    fg.stroke();
    fg.strokeColor = new Color(255, 60, 230, 200);
    fg.lineWidth = 5;
    fg.rect(x0 + 2, y0 + 2, panelW - 4, panelH - 4);
    fg.stroke();
    fg.strokeColor = MAGENTA;
    fg.lineWidth = 2;
    fg.rect(x0 + 5, y0 + 5, panelW - 10, panelH - 10);
    fg.stroke();
    center.addChild(frame);

    const innerW = panelW - borderInset * 2;
    const innerH = panelH - borderInset * 2;
    const inner = new Node('InnerFill');
    inner.layer = Layers.Enum.UI_2D;
    const iui = inner.addComponent(UITransform);
    iui.setContentSize(innerW, innerH);
    iui.setAnchorPoint(0.5, 0.5);
    const ig = inner.addComponent(Graphics);
    fillPanelInnerGraphics(ig, innerW, innerH, PANEL_BG, 0x91a11ce);
    center.addChild(inner);

    // 顶栏标题条（品红实心）
    const head = new Node('PanelHeader');
    head.layer = Layers.Enum.UI_2D;
    const hui = head.addComponent(UITransform);
    hui.setContentSize(innerW, headerH);
    hui.setAnchorPoint(0.5, 1);
    head.setPosition(0, innerH / 2, 0);
    const hg = head.addComponent(Graphics);
    hg.clear();
    hg.fillColor = new Color(140, 28, 108, 200);
    hg.rect(-innerW / 2, -headerH, innerW, headerH);
    hg.fill();
    inner.addChild(head);

    const title = new Node('PanelTitle');
    title.layer = Layers.Enum.UI_2D;
    const tui = title.addComponent(UITransform);
    tui.setContentSize(innerW - 120, headerH);
    tui.setAnchorPoint(0, 0.5);
    title.setPosition(-innerW / 2 + 12, -headerH / 2, 0);
    const tl = title.addComponent(Label);
    tl.string = '游戏区';
    tl.fontSize = 20;
    tl.lineHeight = 24;
    tl.horizontalAlign = Label.HorizontalAlign.LEFT;
    tl.verticalAlign = Label.VerticalAlign.CENTER;
    tl.color = CYAN;
    tl.cacheMode = Label.CacheMode.NONE;
    head.addChild(title);

    const close = new Node('CloseBtn');
    close.layer = Layers.Enum.UI_2D;
    const cui = close.addComponent(UITransform);
    cui.setContentSize(44, headerH);
    cui.setAnchorPoint(1, 0.5);
    close.setPosition(innerW / 2 - 8, -headerH / 2, 0);
    const cLb = close.addComponent(Label);
    cLb.string = 'X';
    cLb.fontSize = 22;
    cLb.lineHeight = 26;
    cLb.horizontalAlign = Label.HorizontalAlign.CENTER;
    cLb.verticalAlign = Label.VerticalAlign.CENTER;
    cLb.color = CYAN;
    cLb.cacheMode = Label.CacheMode.NONE;
    head.addChild(close);

    // 内容区：按示意框收紧并下移，作为推箱子主区域
    const host = new Node('ContentHost');
    host.layer = Layers.Enum.UI_2D;
    const hostUi = host.addComponent(UITransform);
    hostUi.setContentSize(CONTENT_HOST_W, CONTENT_HOST_H);
    hostUi.setAnchorPoint(0.5, 0.5);
    host.setPosition(0, CONTENT_HOST_Y, 0);
    inner.addChild(host);

    parent.addChild(center);
    return center;
  }
}
