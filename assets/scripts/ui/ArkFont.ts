import { resources, TTFFont } from 'cc';

/**
 * assets/resources/fonts/ 下的 ttf，不要写 .ttf 后缀。
 * 依次尝试（含误打成 112 的文件名）。
 */
export const ARK_FONT_RESOURCES_PATHS = ['fonts/ArkPixel112-zh_cn', 'fonts/ArkPixel12-zh_cn'];

export function loadArkPixelFont(onDone: (font: TTFFont | null) => void) {
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
