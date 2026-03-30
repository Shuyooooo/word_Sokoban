export type GameEvent =
  | { type: 'MoveBlocked' }
  | { type: 'PlayerMoved'; x: number; y: number }
  | { type: 'PlayerTextChanged'; text: string }
  | { type: 'BlockAdded'; id: string; text: string; x: number; y: number }
  | { type: 'BlockRemoved'; id: string }
  | { type: 'BlockMoved'; id: string; x: number; y: number }
  | { type: 'BlockTextChanged'; id: string; text: string }
  | { type: 'TigerKilled' }
  | { type: 'FireHit'; hitCount: number }
  | { type: 'SteamStarted' }
  | { type: 'SteamUpdated'; alpha: number }
  | { type: 'PlayerDefeated'; reason: 'tiger' | 'fire' | 'other' }
  | { type: 'LevelWon' };

