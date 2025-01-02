import { Scene } from "phaser";
import { gameConfig } from "../config/GameConfig";
import { WSMessage } from "../types/GameTypes";

export default class GameScene extends Scene {
  private players: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private ws: WebSocket;
  private userId: string;
  private spaceId: string;
  private player: Phaser.GameObjects.Sprite;
  private players: Map<string, Phaser.GameObjects.Sprite> = new Map();
  constructor() {
    super("GameScene");
  }

  preload() {
    this.load.image('map', '../../assets/MetaSpace_map1.png');
    this.load.spritesheet('avatar', '../../assets/Adam_idle_16x16.png', {
      frameWidth: 16,
      frameHeight: 32,
    });
  }

  create() {
    //create ws connection
    this.ws = new WebSocket('ws://localhost:8080')
    //create map
    this.add.image(0,0,'map').setOrigin(0);
    //create the player
    this.player = this.add.sprite(100,100, 'adam', 3);
    //camera follows the avatar
    this.cameras.main.startFollow(this.player); 

    //send the WebSocket events
    this.ws.onopen = () => {
      console.log('Connected to WebSocket');
      this.ws.send(
        JSON.stringify({
          type: 'join',
          payload: {
            spaceId: this.spaceId,
          },
        })
      );
    };
    //handle the response of server
    this.ws.onmessage = (event) => {
      this.handleServerMessages(event);
    }
    // Handle the keyboard events
    this.input.keyboard?.on('keydown',(event: KeyboardEvent) => {
      this.handleMovement(event);
    });

  }

  handleMovement(event: KeyboardEvent) {
    const move = { x: this.player.x/16, y: this.player.y/16};

    switch (event.code) {
      case 'ArrowUp':
        move.y -= 1;
        this.player.setFrame(1); // Back-facing
        break;
      case 'ArrowDown':
        move.y += 1;
        this.player.setFrame(3); // Front-facing
        break;
      case 'ArrowLeft':
        move.x -= 1;
        this.player.setFrame(0); // Left-facing
        break;
      case 'ArrowRight':
        move.x += 1;
        this.player.setFrame(2); // Right-facing
        break;
      default:
        return;
    };
 
    //set the pos of avatar
    this.player.setPosition(move.x * 16, move.y * 16);

    //send server curr movement
    this.ws.send(JSON.stringify({
      type: 'move',
      payload: move,
      })
    );
  }

  handleServerMessages(event: MessageEvent) {
    const message: WSMessage = JSON.parse(event.data);

    switch (message.type) {
      case 'space-joined':
        const { spawn, users } = message.payload;
        const currUser = users[users.length - 1];
        this.userId = currUser.id;
        //setting the pos received from the ws
        this.player.setPosition(spawn.x * 16, spawn.y * 16);
        //add existing users to the Scene
        users.forEach((user: any) => {
          if (user.id !==)
        });
        break;

      case 'user-joined':
        //we need to store the spawn loc of the user joined to render that user
        console.log(`${message.payload.userId} joined the space`);
        break;

      case 'move':
        
    }
  }
}
