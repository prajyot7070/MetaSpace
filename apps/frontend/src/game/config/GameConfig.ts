import { Types } from 'phaser';

export const gameConfig: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1120,  // Adjust based on your needs
  height: 640, // Adjust based on your needs
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 , x: 0},
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  pixelArt: true, // Important for crisp pixel art
  backgroundColor: '#000000'
};
