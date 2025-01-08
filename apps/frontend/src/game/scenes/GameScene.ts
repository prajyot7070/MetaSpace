import { Scene } from "phaser";
import { WSMessage } from "../types/GameTypes";

export default class GameScene extends Scene {
  private ws!: WebSocket;
  private spaceId!: string;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private users!: Map<string, Phaser.GameObjects.Sprite>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super("GameScene");
    this.users = new Map();
  }

  preload() {
    this.load.tilemapTiledJSON('map_json', '/src/assets/MetaSpace_map1.json');
    this.load.image('Metaspace-tileset', '/src/assets/Metaspace-tileset.png');
    this.load.image('Metaspace-Interirors', '/src/assets/Metaspace-Interirors.png');
    this.load.image('Collision-tileset', '/src/assets/Collision-tileset.png');
    this.load.spritesheet('avatar', '/src/assets/Adam_idle_16x16.png', {
      frameWidth: 16,
      frameHeight: 32,
    });
  }

  create() {
    // Initialize physics system
    this.physics.world.setBounds(0, 0, 3200, 3200); // Adjust bounds as needed

    // Create ws connection
    this.ws = new WebSocket('ws://localhost:8080');

    // Create tilemap
    const map = this.make.tilemap({ key: 'map_json' });
    
    // Add tilesets
    const metaspaceTileset = map.addTilesetImage('Metaspace-tileset', 'Metaspace-tileset');
    const interiorsTileset = map.addTilesetImage('Metaspace-Interirors', 'Metaspace-Interirors');
    const collisionTileset = map.addTilesetImage('Collision-tileset', 'Collision-tileset');
    
    if (!metaspaceTileset || !interiorsTileset || !collisionTileset) {
      console.error("Failed to load tilesets");
      return;
    }

    const tileset = [metaspaceTileset, interiorsTileset, collisionTileset];

    // Create Layers
    const floorLayer = map.createLayer('Floor', tileset, 0, 0);
    const floorPlanLayer = map.createLayer('Floor Plan', tileset, 0, 0);
    const furnitureLayer2 = map.createLayer('Furniture 2', tileset, 0, 0);
    const furnitureLayer1 = map.createLayer('Furniture 1', tileset, 0, 0);
    const furnitureLayer3 = map.createLayer('Furniture 3', tileset, 0, 0);
    const collisionLayer = map.createLayer('Collision', tileset, 0, 0);
    const foregroundLayer = map.createLayer('Foreground', tileset, 0, 0);

    // Scale all layers
    const layers = [
      floorLayer, floorPlanLayer, furnitureLayer1, 
      furnitureLayer2, furnitureLayer3, collisionLayer, foregroundLayer
    ];
    
    layers.forEach(layer => {
      if (layer) {
        layer.setScale(4);
      }
    });

    // Set up collision layer
    if (collisionLayer) {
      // Set collision for the entire layer
      collisionLayer.setCollisionByExclusion([-1]);
      
      // Optional: Make collision layer invisible
      collisionLayer.setVisible(false);
      
      
    }

    // Create player with physics
    this.player = this.physics.add.sprite(100, 100, 'avatar', 3);
    this.player.setScale(4);
    
    // Set player physics properties
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0);
    this.player.body.setSize(14, 16); // Adjust hitbox size
    this.player.body.setOffset(1, 16); // Adjust hitbox position

    // Enable collision between player and collision layer
    if (collisionLayer) {
      this.physics.add.collider(
        this.player, 
        collisionLayer, 
        undefined, 
        undefined, 
        this
      );
    }

    // Set up camera
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBounds(0, 0, map.widthInPixels * 4, map.heightInPixels * 4);

    // Create cursor keys
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Set foreground layer depth
    if (foregroundLayer) {
      foregroundLayer.setDepth(1);
    }

    // WebSocket setup
    this.setupWebSocket();
  }

  private setupWebSocket() {
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

    this.ws.onmessage = (event) => {
      this.handleServerMessages(event);
    };
  }

  // Your existing handleServerMessages, addUser, and removeUser methods remain the same
  
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


  update() {
    if (!this.cursors || !this.player) return;

    const speed = 200;
    let velocityX = 0;
    let velocityY = 0;

    // Handle horizontal movement
    if (this.cursors.left.isDown) {
      velocityX = -speed;
      this.player.setFrame(2);
    } else if (this.cursors.right.isDown) {
      velocityX = speed;
      this.player.setFrame(0);
    }

    // Handle vertical movement
    if (this.cursors.up.isDown) {
      velocityY = -speed;
      this.player.setFrame(1);
    } else if (this.cursors.down.isDown) {
      velocityY = speed;
      this.player.setFrame(3);
    }

    // Apply velocity to player
    this.player.setVelocity(velocityX, velocityY);

    // Only send WebSocket updates if the player is moving
    if (velocityX !== 0 || velocityY !== 0) {
      this.ws.send(JSON.stringify({
        type: 'move',
        payload: {
          x: this.player.x / 16,
          y: this.player.y / 16,
        },
      }));
    }
  }
}
