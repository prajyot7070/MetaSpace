export interface PlayerState {
  id: string;
  x: number;
  y: number;
}

//export interface UserSate {
//  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
//  lastPosition: {x: number, y: number};
//}

export interface GameState {
  players: Map<string, PlayerState>;
}

export interface GameConfig {
  spaceId: string;
  userId: string;
}

export type WSMessage = {
  type: 'join' | 'move' | 'user-joined' | 'user-left' | 'space-joined';
  payload: any;
}
