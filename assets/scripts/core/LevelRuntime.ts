import { GridModel, type Dir, type GridSnapshot } from '../GridModel';
import type { GameEvent } from './GameEvent';
import type { LevelType } from './RuleEngine';

type RuntimeState = {
  player: { x: number; y: number };
  playerText: string;
  defeated: boolean;
  won: boolean;
  tigerAlive: boolean;
  fireHitCount: number;
  steam: boolean;
  steamAlpha: number;
  blocks: Map<string, { x: number; y: number; text: string }>;
};

export class LevelRuntime {
  private model: GridModel;
  private levelType: LevelType;

  constructor(snapshot: GridSnapshot) {
    this.model = new GridModel(snapshot);
    this.levelType = snapshot.levelType ?? 'tigerDoor';
  }

  getModel() {
    return this.model;
  }

  getLevelType(): LevelType {
    return this.levelType;
  }

  move(dir: Dir): GameEvent[] {
    const prev = this.captureState();
    const moved = this.model.tryMove(dir);
    if (!moved) return [{ type: 'MoveBlocked' }];
    const next = this.captureState();
    return this.diff(prev, next);
  }

  tick(dt: number): GameEvent[] {
    const changed = this.model.update(dt);
    if (!changed) return [];
    return [{ type: 'SteamUpdated', alpha: this.model.getSteamAlpha() }];
  }

  private captureState(): RuntimeState {
    const blocks = new Map<string, { x: number; y: number; text: string }>();
    for (const b of this.model.getBlocks()) {
      blocks.set(b.id, { x: b.x, y: b.y, text: b.text });
    }
    return {
      player: { ...this.model.player },
      playerText: this.model.getPlayerText(),
      defeated: this.model.isPlayerDefeated(),
      won: this.model.isWin(),
      tigerAlive: this.model.hasTigerAlive(),
      fireHitCount: this.model.getFireHitCount(),
      steam: this.model.hasSteam(),
      steamAlpha: this.model.getSteamAlpha(),
      blocks,
    };
  }

  private diff(prev: RuntimeState, next: RuntimeState): GameEvent[] {
    const events: GameEvent[] = [];
    if (prev.player.x !== next.player.x || prev.player.y !== next.player.y) {
      events.push({ type: 'PlayerMoved', x: next.player.x, y: next.player.y });
    }
    if (prev.playerText !== next.playerText) {
      events.push({ type: 'PlayerTextChanged', text: next.playerText });
    }

    for (const [id, p] of prev.blocks) {
      const n = next.blocks.get(id);
      if (!n) {
        events.push({ type: 'BlockRemoved', id });
        continue;
      }
      if (p.x !== n.x || p.y !== n.y) {
        events.push({ type: 'BlockMoved', id, x: n.x, y: n.y });
      }
      if (p.text !== n.text) {
        events.push({ type: 'BlockTextChanged', id, text: n.text });
      }
    }
    for (const [id, n] of next.blocks) {
      if (prev.blocks.has(id)) continue;
      events.push({ type: 'BlockAdded', id, text: n.text, x: n.x, y: n.y });
    }

    if (prev.tigerAlive && !next.tigerAlive) events.push({ type: 'TigerKilled' });
    if (next.fireHitCount > prev.fireHitCount) {
      events.push({ type: 'FireHit', hitCount: next.fireHitCount });
    }
    if (!prev.steam && next.steam) events.push({ type: 'SteamStarted' });
    if (prev.steamAlpha !== next.steamAlpha) {
      events.push({ type: 'SteamUpdated', alpha: next.steamAlpha });
    }
    if (!prev.defeated && next.defeated) {
      const reason = next.playerText === '化石' ? 'fire' : next.playerText === '小零食' ? 'tiger' : 'other';
      events.push({ type: 'PlayerDefeated', reason });
    }
    if (!prev.won && next.won) events.push({ type: 'LevelWon' });
    return events;
  }
}

