import { resources, TTFFont } from 'cc';

/**
 * assets/resources/fonts/ 下的 ttf，不要写 .ttf 后缀。
 * 依次尝试（含误打成 112 的文件名）。
 */
export const ARK_FONT_RESOURCES_PATHS = ['fonts/ArkPixel112-zh_cn', 'fonts/ArkPixel12-zh_cn'];

export function loadArkPixelFont(onDone: (font: TTFFont | null) => void) {
  // GitHub Pages/web builds in this project may not emit TTFFont native payloads,
  // which causes noisy 404s on `assets/resources/native/**/*.ttf`.
  // Fallback to system font on web runtime for stability and full CJK coverage.
  if (typeof window !== 'undefined') {
    onDone(null);
    return;
  }

  const tryPath = (index: number) => {
    if (index >= ARK_FONT_RESOURCES_PATHS.length) {
      onDone(null);
      return;
    }
    const p = ARK_FONT_RESOURCES_PATHS[index];
    resources.load(p, TTFFont, (err, font) => {
      if (err || !font) {
        tryPath(index + 1);
        return;
      }
      onDone(font);
    });
  };
  tryPath(0);
}
