import { Color, Label, LabelOutline, Layers, Node, RichText, UITransform } from 'cc';
import type { GameEvent } from '../core/GameEvent';
import type { LevelConfig, StoryRule, StorySegment } from '../LevelParser';
import { NodeFactory } from '../view/NodeFactory';
import { loadArkPixelFont } from './ArkFont';

const PX_MAIN = 18;
const PX_FOOT = 12;

const DESIGN_W = 1280;
const STORY_H = 300;
const FOOTER_H = 28;

/** 叙述红 / 词条青 */
const COLOR_NARRATION = '#ff5c5c';
const COLOR_TERM = '#5cefff';

function escapeRichText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function segmentsToBbcode(segments: StorySegment[]): string {
  return segments
    .map((seg) => {
      const t = escapeRichText(seg.text);
      const hex = seg.kind === 'term' ? COLOR_TERM : COLOR_NARRATION;
      return `<color=${hex}>${t}</color>`;
    })
    .join('');
}

function lineToBbcode(line: string): string {
  return `<color=${COLOR_NARRATION}>${escapeRichText(line)}</color>`;
}

type TypingBlock = {
  chars: string[];
  prependGap: boolean;
};

export class StoryPanelController {
  private root: Node;
  private storyRich: RichText;
  private footerLabel: Label;
  private rules: StoryRule[] = [];
  private firedRuleIndices = new Set<number>();
  private typingQueue: TypingBlock[] = [];
  private typingLoopRunning = false;
  private typingRunId = 0;

  /** 逐字显示速度（毫秒/字） */
  private readonly typeMsPerChar = 48;

  constructor(root: Node) {
    this.root = root;
    root.layer = Layers.Enum.UI_2D;
    const ui = root.getComponent(UITransform) ?? root.addComponent(UITransform);
    ui.setContentSize(DESIGN_W - 80, STORY_H);
    ui.setAnchorPoint(0.5, 0.5);

    const storyH = STORY_H - FOOTER_H - 12;
    const storyNode = new Node('StoryRich');
    storyNode.layer = Layers.Enum.UI_2D;
    const uiStory = storyNode.addComponent(UITransform);
    uiStory.setContentSize(DESIGN_W - 80, storyH);
    uiStory.setAnchorPoint(0.5, 1);
    storyNode.setPosition(0, STORY_H / 2 - FOOTER_H - 6, 0);

    const rt = storyNode.addComponent(RichText);
    rt.horizontalAlign = Label.HorizontalAlign.LEFT;
    rt.verticalAlign = Label.VerticalAlign.TOP;
    rt.fontSize = PX_MAIN;
    rt.lineHeight = Math.floor(PX_MAIN * 1.35);
    rt.maxWidth = DESIGN_W - 80;
    rt.string = '';
    this.storyRich = rt;
    root.addChild(storyNode);

    const foot = NodeFactory.createLabelNode(
      'Footer',
      'R 重来 · N 下一关 · D 调试网格',
      DESIGN_W - 80,
      FOOTER_H,
      PX_FOOT,
      new Color(160, 180, 200, 200)
    );
    foot.node.setPosition(0, -STORY_H / 2 + 14, 0);
    foot.label.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.footerLabel = foot.label;
    foot.label.cacheMode = Label.CacheMode.BITMAP;
    this.addNeonOutline(foot.node, new Color(0, 200, 255, 100), 1);
    root.addChild(foot.node);

    this.loadArkPixelFont();
  }

  private addNeonOutline(labelNode: Node, outlineColor: Color, width: number) {
    const o = labelNode.addComponent(LabelOutline);
    o.color = outlineColor;
    o.width = width;
  }

  private loadArkPixelFont() {
    loadArkPixelFont((font) => {
      if (!font) {
        console.error(
          '[StoryPanel] 方舟字体未加载 → 故事区仍在用系统字体。\n' +
            '请确认：① 文件在 assets/resources/fonts/（不是 assets/fonts/）；② 文件名与代码里一致，例如 ArkPixel112-zh_cn.ttf 或 ArkPixel12-zh_cn.ttf；③ 浏览器预览按 F12 看 Console。'
        );
        return;
      }
      this.storyRich.font = font;
      this.storyRich.useSystemFont = false;
      this.footerLabel.font = font;
      this.footerLabel.useSystemFont = false;
      this.footerLabel.cacheMode = Label.CacheMode.BITMAP;
    });
  }

  beginLevel(config: LevelConfig) {
    this.rules = config.storyRules ?? [];
    this.firedRuleIndices.clear();
    this.typingRunId++;
    this.typingQueue = [];
    this.typingLoopRunning = false;
    this.storyRich.string = '';

    if (config.storyIntroSegments?.length) {
      this.enqueueTypingBlock(this.segmentsToCharBbcode(config.storyIntroSegments), false);
    } else if (config.storyIntro?.trim()) {
      this.enqueueTypingBlock(this.lineToCharBbcode(config.storyIntro.trim()), false);
    }
  }

  processEvents(events: GameEvent[]) {
    for (const ev of events) {
      // 用户要求：老虎被杀/玩家被老虎杀后，故事区不新增文案
      if (ev.type === 'TigerKilled') continue;
      if (ev.type === 'PlayerDefeated' && ev.reason === 'tiger') continue;
      for (let i = 0; i < this.rules.length; i++) {
        if (this.firedRuleIndices.has(i)) continue;
        const r = this.rules[i];
        if (!this.ruleMatches(r, ev)) continue;
        const once = r.once !== false;
        if (once) this.firedRuleIndices.add(i);
        this.appendRuleLine(r);
        break;
      }
    }
  }

  private appendRuleLine(rule: StoryRule) {
    if (rule.lineSegments?.length) {
      this.enqueueTypingBlock(this.segmentsToCharBbcode(rule.lineSegments), true);
    } else if (rule.line?.trim()) {
      this.enqueueTypingBlock(this.lineToCharBbcode(rule.line.trim()), true);
    }
  }

  private segmentsToCharBbcode(segments: StorySegment[]): string[] {
    const out: string[] = [];
    for (const seg of segments) {
      const hex = seg.kind === 'term' ? COLOR_TERM : COLOR_NARRATION;
      for (const ch of [...seg.text]) {
        out.push(`<color=${hex}>${escapeRichText(ch)}</color>`);
      }
    }
    return out;
  }

  private lineToCharBbcode(line: string): string[] {
    return [...line].map((ch) => `<color=${COLOR_NARRATION}>${escapeRichText(ch)}</color>`);
  }

  private enqueueTypingBlock(chars: string[], prependGap: boolean) {
    if (chars.length === 0) return;
    this.typingQueue.push({ chars, prependGap });
    if (!this.typingLoopRunning) {
      this.typingLoopRunning = true;
      this.consumeTypingQueue(this.typingRunId).catch((e) => {
        console.warn('[StoryPanel] typing loop failed:', e);
        this.typingLoopRunning = false;
      });
    }
  }

  private async consumeTypingQueue(runId: number) {
    while (this.typingQueue.length > 0) {
      if (runId !== this.typingRunId) return;
      const item = this.typingQueue.shift();
      if (!item) continue;
      if (item.prependGap && this.storyRich.string.length > 0) {
        this.storyRich.string += '\n\n';
      }
      for (const ch of item.chars) {
        if (runId !== this.typingRunId) return;
        this.storyRich.string += ch;
        await this.sleep(this.typeMsPerChar);
      }
    }
    this.typingLoopRunning = false;
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  private ruleMatches(r: StoryRule, ev: GameEvent): boolean {
    if (r.on === 'BlockAdded' && ev.type === 'BlockAdded') {
      if (r.text !== undefined && r.text !== ev.text) return false;
      return true;
    }
    if (r.on === 'SteamStarted' && ev.type === 'SteamStarted') return true;
    if (r.on === 'TigerKilled' && ev.type === 'TigerKilled') return true;
    if (r.on === 'LevelWon' && ev.type === 'LevelWon') return true;
    return false;
  }
}
