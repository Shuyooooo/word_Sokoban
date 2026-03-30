方舟像素字体 — 手动放入说明
================================

1. 打开发布页（任选其一）：
   https://github.com/TakWolf/ark-pixel-font/releases
   或 itch.io：搜索 "Ark Pixel Font"

2. 下载「12px + proportional + ttf」的 zip，例如：
   ark-pixel-font-12px-proportional-ttf-vXXXX.XX.XX.zip

3. 解压后，在文件夹里找到「简体中文 zh_cn」对应的 .ttf
   （文件名里通常带 zh_cn 或 zh-cn）

4. 把该 .ttf 复制到本目录（必须是下面这一层，少一层都不行）：
   assets/resources/fonts/
   不要放到 assets/fonts/ —— 放错文件夹时，游戏运行时加载不到，只会用系统字。

5. 重命名示例（与代码里 resources.load 一致，任选其一）：
   ArkPixel112-zh_cn.ttf   或   ArkPixel12-zh_cn.ttf
   （你截图里是 112，代码会先尝试这个名字）

6. 回到 Cocos Creator，等资源导入完成（会生成 .meta）。

7. 运行游戏：故事区会自动用该字体 + 发光描边。

8. 如何确认真的换上了像素字？
   - 资源管理器里能看到 ArkPixel112-zh_cn.ttf（或 ArkPixel12-zh_cn.ttf）和 .meta，且路径在 resources/fonts 下
   - 浏览器预览按 F12 → Console，不应出现「方舟字体未加载」的 error
   - 若未加载：会退回系统黑体/微软雅黑，笔画圆滑、没有方块像素感，只剩描边像霓虹灯

9. 字号已按「12 的倍数」设置；勿在编辑器里随便改成 18、22 等非整倍数，否则像素字会发糊。

——
「Label」是什么：Cocos 里用来显示文字的组件叫 cc.Label（脚本里是 this.storyLabel 等），
故事正文、提示、快捷键说明都是 Label；不是指「标签纸」，就是屏幕上的那段字。
