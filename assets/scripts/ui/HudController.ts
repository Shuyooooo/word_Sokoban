import { Node } from 'cc';

/** 拟物按钮已移除；操作依赖键盘（见 StoryPanel 页脚）。 */
export class HudController {
  constructor(_root: Node) {
    void _root;
  }

  init(_onDebug: () => void, _onRestart: () => void, _onNext: () => void) {
    void _onDebug;
    void _onRestart;
    void _onNext;
  }

  setHint(_text: string) {
    void _text;
  }

  setDebugVisible(_on: boolean) {
    void _on;
  }

  showRestart(_show: boolean) {
    void _show;
  }

  showNext(_show: boolean) {
    void _show;
  }
}
