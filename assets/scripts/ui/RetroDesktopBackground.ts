import { Color, Graphics, Layers, Node, UITransform } from 'cc';

/** 四角/边缘：近黑、冷紫（相机清屏与晕影边缘） */
export const DESKTOP_EDGE = new Color(6, 4, 16, 255);

/** 屏幕中心径向光晕：低饱和冷紫品（减轻偏红） */
export const DESKTOP_CENTER = new Color(28, 12, 42, 255);

/** 兼容旧命名：与中心光晕色一致 */
export const DESKTOP_BASE = DESKTOP_CENTER;

function lerpColor(a: Color, b: Color, t: number): Color {
  const u = Math.max(0, Math.min(1, t));
  return new Color(
    Math.round(a.r + (b.r - a.r) * u),
    Math.round(a.g + (b.g - a.g) * u),
    Math.round(a.b + (b.b - a.b) * u),
    Math.round(a.a + (b.a - a.a) * u)
  );
}

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 自中心向外的径向底色（网格近似），边缘为 DESKTOP_EDGE，中心为 DESKTOP_CENTER。
 */
function fillRadialVignetteBase(g: Graphics, w: number, h: number): void {
  const halfW = w / 2;
  const halfH = h / 2;
  const maxR = Math.sqrt(halfW * halfW + halfH * halfH);
  const cell = 18;
  const nx = Math.max(1, Math.ceil(w / cell));
  const ny = Math.max(1, Math.ceil(h / cell));
  const stepX = w / nx;
  const stepY = h / ny;

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = -halfW + (i + 0.5) * stepX;
      const cy = -halfH + (j + 0.5) * stepY;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const t = smoothstep01(dist / maxR);
      g.fillColor = lerpColor(DESKTOP_CENTER, DESKTOP_EDGE, t);
      const x0 = -halfW + i * stepX;
      const y0 = -halfH + j * stepY;
      g.rect(x0, y0, stepX + 0.5, stepY + 0.5);
      g.fill();
    }
  }
}

/**
 * 全屏雪花噪点（冷灰紫，减轻暖粉感）。
 */
function drawDesktopFilmGrain(g: Graphics, w: number, h: number, grainSeed: number): void {
  const halfW = w / 2;
  const halfH = h / 2;
  const rnd = mulberry32(grainSeed);
  const dots = 8800;
  for (let i = 0; i < dots; i++) {
    const x = Math.floor(-halfW + rnd() * w);
    const y = Math.floor(-halfH + rnd() * h);
    const a = 8 + Math.floor(rnd() * 28);
    const cool = rnd() > 0.5;
    if (cool) {
      g.fillColor = new Color(210, 212, 230, a);
    } else {
      g.fillColor = new Color(165, 168, 188, Math.min(255, a + 4));
    }
    g.rect(x, y, 1, 1);
    g.fill();
  }

  const rnd2 = mulberry32((grainSeed ^ 0xace1beef) >>> 0);
  const coarse = 1200;
  for (let i = 0; i < coarse; i++) {
    const x = Math.floor(-halfW + rnd2() * w);
    const y = Math.floor(-halfH + rnd2() * h);
    const a = 3 + Math.floor(rnd2() * 12);
    g.fillColor = new Color(240, 242, 255, a);
    g.rect(x, y, 2, 1);
    g.fill();
  }
}

/**
 * 全屏：径向晕影底 + 细密雪花噪点。
 */
export function fillRetroDesktopGraphics(g: Graphics, w: number, h: number, grainSeed = 0x4e5f6a7b): void {
  g.clear();
  fillRadialVignetteBase(g, w, h);
  drawDesktopFilmGrain(g, w, h, grainSeed);
}

/** 与 DESKTOP_EDGE 同系、略深的封面遮罩（非纯黑） */
export const DESKTOP_FADE_SOLID = new Color(8, 4, 14, 255);

/**
 * 中央游戏窗格：半透明底色 + 较弱噪点（先铺底再叠点）。
 */
export function fillPanelInnerGraphics(
  g: Graphics,
  w: number,
  h: number,
  baseColor: Color,
  grainSeed: number
): void {
  const halfW = w / 2;
  const halfH = h / 2;
  g.clear();
  g.fillColor = baseColor;
  g.rect(-halfW, -halfH, w, h);
  g.fill();

  const rnd = mulberry32(grainSeed);
  const dots = 3200;
  for (let i = 0; i < dots; i++) {
    const x = Math.floor(-halfW + rnd() * w);
    const y = Math.floor(-halfH + rnd() * h);
    const a = 6 + Math.floor(rnd() * 20);
    g.fillColor = new Color(200, 202, 218, a);
    g.rect(x, y, 1, 1);
    g.fill();
  }
  const rnd2 = mulberry32((grainSeed ^ 0x51eed) >>> 0);
  for (let i = 0; i < 450; i++) {
    const x = Math.floor(-halfW + rnd2() * w);
    const y = Math.floor(-halfH + rnd2() * h);
    const a = 2 + Math.floor(rnd2() * 10);
    g.fillColor = new Color(235, 237, 248, a);
    g.rect(x, y, 2, 1);
    g.fill();
  }
}

/**
 * 创建全屏 UI 节点并绘制复古桌面（供封面兜底等复用）。
 */
export function createFullScreenRetroBackdropNode(name: string, w: number, h: number, seed?: number): Node {
  const n = new Node(name);
  n.layer = Layers.Enum.UI_2D;
  const ui = n.addComponent(UITransform);
  ui.setContentSize(w, h);
  ui.setAnchorPoint(0.5, 0.5);
  n.setPosition(0, 0, 0);
  const g = n.addComponent(Graphics);
  fillRetroDesktopGraphics(g, w, h, seed);
  return n;
}
