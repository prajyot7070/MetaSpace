import { Scene} from "phaser";
import { WSMessage } from "../types/GameTypes";

export default class GameScene extends Scene {
  private ws!: WebSocket;
//  private userId!: string;
  private spaceId!: string;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private users!: Map<string, Phaser.GameObjects.Sprite>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  constructor() {
    super("GameScene");
    this.users = new Map();
  }

  preload() {
    this.load.tilemapTiledJSON('map_json','/src/assets/MetaSpace_map1.json');
    this.load.image('Metaspace-tileset', '/src/assets/Metaspace-tileset.png');
    this.load.image('Metaspace-Interirors', '/src/assets/Metaspace-Interirors.png');
    this.load.image('Collision-tileset', '/src/assets/Collision-tileset.png');
    this.load.spritesheet('avatar', '/src/assets/Adam_idle_16x16.png', {
        frameWidth: 16,
        frameHeight: 32,
    });
}
  create() {
    //create ws connection
    this.ws = new WebSocket('ws://localhost:8080')
    // Create tilemap
    const map = this.make.tilemap({ key: 'map_json' });
    // Add tilsets
    const metaspaceTileset = map.addTilesetImage('Metaspace-tileset', 'Metaspace-tileset');
    const interiorsTileset = map.addTilesetImage('Metaspace-Interirors', 'Metaspace-Interirors');
    const collisionTileset = map.addTilesetImage('Collision-tileset', 'Collision-tileset');
    if (!metaspaceTileset || !interiorsTileset || !collisionTileset) {
      console.log("Failed to load tilesets");
      return;
    }
    const tileset = [ metaspaceTileset, interiorsTileset, collisionTileset];
    //Create Layers
    const floorLayer = map.createLayer('Floor', tileset!, 0, 0);
    const floorPlanLayer = map.createLayer('Floor Plan', tileset!, 0, 0);
    const furnitureLayer2 = map.createLayer('Furniture 2', tileset!, 0, 0);
    const furnitureLayer1 = map.createLayer('Furniture 1', tileset!, 0, 0);
    const furnitureLayer3 = map.createLayer('Furniture 3', tileset!, 0, 0);
    const collisionLayer = map.createLayer('Collision', tileset!, 0, 0);
    const foregroundLayer = map.createLayer('Foreground', tileset!, 0, 0);
     
    furnitureLayer1?.setVisible(true);
    // Scale all layers
    const layers = [floorLayer, floorPlanLayer, furnitureLayer1, furnitureLayer2, 
                   furnitureLayer3, collisionLayer, foregroundLayer];
    
    layers.forEach(layer => {
        if (layer) {
            layer.setScale(4); // Adjust this scale value as needed
        }
    });
    //Collision layer
    if (collisionLayer) {  
      collisionLayer.setCollisionByProperty({collides: true});
      console.log("Collision set")
    }
    //create the player with physics
    this.player = this.physics.add.sprite(100,100, 'avatar', 3);
    this.player.setScale(4);
    //this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, collisionLayer!);
    this.cursors = this.input.keyboard!.createCursorKeys();
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
    
    foregroundLayer?.setDepth(1);
  }

  
  
 handleMovement(event: KeyboardEvent) {
    const velocity = 250; // Pixels per second
    const playerVelocity = { x: 0, y: 0 };

    switch (event.code) {
      case 'ArrowUp':
        playerVelocity.y = -velocity;
        this.player.setFrame(1);
        break;
      case 'ArrowDown':
        playerVelocity.y = velocity;
        this.player.setFrame(3);
        break;
      case 'ArrowLeft':
        playerVelocity.x = -velocity;
        this.player.setFrame(2);
        break;
      case 'ArrowRight':
        playerVelocity.x = velocity;
        this.player.setFrame(0);
        break;
    }

    // Apply velocity to player
    this.player.setVelocity(playerVelocity.x, playerVelocity.y);

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
        console.log("space-joined");
        const { spawn: spawn, users: usersList } = message.payload;
        console.log("UsersList :- " + usersList)
        //const currUser = users[users.length - 1];
        //this.userId = currUser.id;
        //setting the pos received from the ws
        this.player.setPosition(spawn.x * 16, spawn.y * 16);
        //add existing users to the Scene
        usersList.forEach((user: any) => {
          if (user.id) {
            console.log(`Adding user ${usersList}`); //debugging
            this.addUser(user.id, user.x, user.y);
          }
        });
        break;

      case 'user-joined':
        //we need to store the spawn loc of the user joined to render that user
        const {userId, x , y} = message.payload;
        this.addUser(userId, x, y);
        console.log(`New User ${message.payload.userId} joined the space`);
        break;

      case 'move':
        const {userId: movingUserID, x: newX, y: newY}  = message.payload;
        console.log(`User ${movingUserID} moved to ${newX} , ${newY}`);
        const movingUser = this.users.get(movingUserID);
        if (movingUser) {
          movingUser.setPosition(newX*16, newY*16);
        }
        break;

      case 'user-left':
        const {userId: leavingUserID} = message.payload;
        this.removeUser(leavingUserID);
        console.log(`User ${leavingUserID} left.`);
    
    }
  }

  addUser(userId: string, x: number, y:number){
    if (this.users.has(userId)) return;
    console.log(`Adding Sprite for User ${userId} at ${x}, ${y}`);
    const userSprite = this.add.sprite(x*16, y*16, 'avatar', 3);
    userSprite.setScale(4);
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
 // Collision and movement handling
  if (this.cursors.left.isDown) {
    this.player.setVelocityX(-160);
  } else if (this.cursors.right.isDown) {
    this.player.setVelocityX(160);
  } else {
    this.player.setVelocityX(0);
  }

  if (this.cursors.up.isDown) {
    this.player.setVelocityY(-160);
  } else if (this.cursors.down.isDown) {
    this.player.setVelocityY(160);
  } else {
    this.player.setVelocityY(0);
  }
  }
}
