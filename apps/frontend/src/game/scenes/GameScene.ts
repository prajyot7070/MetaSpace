import { Scene } from "phaser";
import { gameConfig } from "../config/GameConfig";
import { WSMessage } from "../types/GameTypes";

export default class GameScene extends Scene {
  private ws!: WebSocket;
  private userId!: string;
  private spaceId!: string;
  private player!: Phaser.GameObjects.Sprite;
  private users!: Map<string, Phaser.GameObjects.Sprite>;
  constructor() {
    super("GameScene");
    this.users = new Map();
  }

  preload() {
    this.load.tilemapTiledJSON('map_json','/src/assets/MetaSpace_map1.json');
    this.load.image('map', '/src/assets/MetaSpace_map1.png');
    this.load.spritesheet('avatar', '/src/assets/Adam_idle_16x16.png', {
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
    this.player = this.physics.add.sprite(100,100, 'avatar', 3);
    this.player.setScale(4);
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
      event.preventDefault();
      this.handleMovement(event);
    });

  }

  
  handleMovement(event: KeyboardEvent) {
    const currentX = this.player.x;
    const currentY = this.player.y;
    const moveDistance = 16; // One tile width/height

    switch (event.code) {
      case 'ArrowUp':
        this.player.setPosition(currentX, currentY - moveDistance);
        this.player.setFrame(1);
        break;
      case 'ArrowDown':
        this.player.setPosition(currentX, currentY + moveDistance);
        this.player.setFrame(3);
        break;
      case 'ArrowLeft':
        this.player.setPosition(currentX - moveDistance, currentY);
        this.player.setFrame(2);
        break;
      case 'ArrowRight':
        this.player.setPosition(currentX + moveDistance, currentY);
        this.player.setFrame(0);
        break;
      default:
        return;
    }

    // Send server current position (divided by 16 for tile coordinates)
    this.ws.send(JSON.stringify({
      type: 'move',
      payload: {
        x: this.player.x / 16,
        y: this.player.y / 16,
      },
    }));

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
          if (user.id !== this.userId) {
            this.addUser(user.id, user.x, user.y);
          }
        });
        break;

      case 'user-joined':
        //we need to store the spawn loc of the user joined to render that user
        const {userId, x , y} = message.payload;
        this.addUser(userId, x, y);
        console.log(`${message.payload.userId} joined the space`);
        break;

      case 'move':
        const {movingUserID, newX, newY}  = message.payload;
        const movingUser = this.users.get(movingUserID);
        if (movingUser) {
          movingUser.setPosition(newX*16, newY*16);
        }
        break;

      case 'user-left':
        const {leavingUserID} = message.payload;
        this.removeUser(leavingUserID);
        console.log(`User ${leavingUserID} left.`);
    
    }
  }

  addUser(userId: string, x: number, y:number){
    if (this.users.has(userId)) return;
    const userSprite = this.add.sprite(x*16, y*16, 'adam', 3);
    this.users.set(userId, userSprite);
  }

  removeUser(userId: string) {
    const userSprite = this.users.get(userId);
    if(userSprite) {
      userSprite.destroy();
      this.users.delete(userId);
      console.log(`User ${userId} left the space`);
    }
  }

  update(){
      
  }
}
