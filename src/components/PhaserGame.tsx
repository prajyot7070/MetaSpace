
import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';

const PhaserGame: React.FC = () => {
  const gameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Define the Phaser game configuration
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: gameRef.current || undefined, // Attach Phaser to the div
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 }, // No gravity, for top-down movement
        },
      },
      scene: {
        preload,
        create,
        update,
      },
    };

    const game = new Phaser.Game(config);

    // Cleanup Phaser on component unmount
    return () => {
      game.destroy(true);
    };
  }, []);

  // Character variables
  let player: Phaser.Physics.Arcade.Sprite;
  let cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  //MetaSpaceM1

  function preload(this: Phaser.Scene) {
    // Load a simple character sprite; replace with your asset path
    this.load.image('character', '../../public/Modern_Interiors_Free_v2.2/Modern tiles_Free/Characters_free/Bob_idle_16x16.png');
    this.load.tilemapTiledJSON('map','../../public/MetaSpaceM1.json');
    this.load.image('tiles', '../../public/MetaSpaceM1.png');
  }

  function create(this: Phaser.Scene) {
    // Create the player sprite at the center of the screen
    //const map = this.make.tilemap({key: 'map'});
    //const tileset = map.addTilesetImage('Furniture', 'tiles'); 
    //const groundlayer = map.createLayer('Ground', tileset);
    this.add.image(300,600,'tiles');
    
    player = this.physics.add.sprite(400, 300, 'character','4');
    player.setScale(3);

    // Enable cursor key input
    cursors = this.input.keyboard.createCursorKeys();
  }

  function update(this: Phaser.Scene) {
    // Reset velocity so it stops moving when no keys are pressed
    player.setVelocity(0);

    // Check which arrow key is pressed and set velocity accordingly
    if (cursors.left?.isDown) {
      player.setVelocityX(-160);
    } else if (cursors.right?.isDown) {
      player.setVelocityX(160);
    }

    if (cursors.up?.isDown) {
      player.setVelocityY(-160);
    } else if (cursors.down?.isDown) {
      player.setVelocityY(160);
    }
  }

  return <div ref={gameRef} style={{ width: '100%', height: '100%' }} />;
};

export default PhaserGame;
