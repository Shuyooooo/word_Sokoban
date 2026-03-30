import { EventKeyboard, input, Input, KeyCode, _decorator } from 'cc';
import type { Dir } from './GridModel';

const { ccclass } = _decorator;

@ccclass('InputController')
export class InputController {
  private onDir: (dir: Dir) => void;

  constructor(onDir: (dir: Dir) => void) {
    this.onDir = onDir;
  }

  start() {
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
  }

  stop() {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
  }

  private onKeyDown(e: EventKeyboard) {
    const dir = this.keyToDir(e.keyCode);
    if (!dir) return;
    this.onDir(dir);
  }

  private keyToDir(code: KeyCode): Dir | null {
    switch (code) {
      case KeyCode.ARROW_UP:
      case KeyCode.KEY_W:
        return { dx: 0, dy: -1 };
      case KeyCode.ARROW_DOWN:
      case KeyCode.KEY_S:
        return { dx: 0, dy: 1 };
      case KeyCode.ARROW_LEFT:
      case KeyCode.KEY_A:
        return { dx: -1, dy: 0 };
      case KeyCode.ARROW_RIGHT:
      case KeyCode.KEY_D:
        return { dx: 1, dy: 0 };
      default:
        return null;
    }
  }
}

