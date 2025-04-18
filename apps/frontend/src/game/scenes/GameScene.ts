import { Scene } from "phaser";
import { WSMessage} from "../types/GameTypes";
import { RTCClient } from "../../rtcClient";
import { type } from "os";

interface UserData {
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  lastPosition: { x: number; y: number };
}

export default class GameScene extends Scene {
  private ws!: WebSocket;
  private spaceId!: string;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private users!: Map<string, UserData>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private rtcClient: RTCClient | null = null;

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
    this.spaceId = this.game.registry.get('spaceId');
    // Initialize physics system
    this.physics.world.setBounds(0, 0, 3200, 3200); // Adjust bounds as needed

    // Create ws connection
    this.setupWebSocket();

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

    // Setup RTC event listeners
    this.setupRTCEventListeners();

    //clean up
    window.addEventListener('beforeunload', () => this.cleanup());
  }

  private setupRTCEventListeners() {
    // Listen for custom events from Areana component
    window.addEventListener('start-call', async (e: Event) => {
      const event = e as CustomEvent;
      const { token, spaceId } = event.detail;
      if (this.rtcClient && token && spaceId) {
        try {
          console.log("[GameScene] Starting call with token:", token);
          this.rtcClient.startCall(token, spaceId);
        } catch (error) {
          console.error("[GameScene] Error starting call:", error);
        }
      }
    });

    window.addEventListener('end-call', (e: Event) => {
      const event = e as CustomEvent;
      const { token } = event.detail;
      if (this.rtcClient && token) {
        console.log("[GameScene] Ending call with token:", token);
        this.rtcClient.endCall(token);
      }
    });

    window.addEventListener('accept-call', async (e: Event) => {
      const event = e as CustomEvent;
      const { token, callerId } = event.detail;
      if (this.rtcClient && token && callerId) {
        try {
          console.log("[GameScene] Accepting call from:", callerId);
          this.rtcClient.acceptCall(token, callerId);
        } catch (error) {
          console.error("[GameScene] Error accepting call:", error);
        }
      }
    });

    window.addEventListener('decline-call', (e: Event) => {
      const event = e as CustomEvent;
      const { token, callerId } = event.detail;
      if (this.rtcClient && token && callerId) {
        console.log("[GameScene] Declining call from:", callerId);
        this.rtcClient.declineCall(token, callerId);
      }
    });

    window.addEventListener('produce-tracks', async (e: Event) => {
      console.log("[GameScene] Producing tracks");
      const event = e as CustomEvent;
      const { audioTrack, videoTrack } = event.detail;
      
      if (this.rtcClient) {
        try {
          if (audioTrack) {
            console.log("[GameScene] Producing audio track");
            await this.rtcClient.produce(audioTrack);
          }
          
          if (videoTrack) {
            console.log("[GameScene] Producing video track");
            await this.rtcClient.produce(videoTrack);
          }
        } catch (error) {
          console.error("[GameScene] Error producing tracks:", error);
        }
      }
    });
  }

  private setupWebSocket() {
    this.ws = new WebSocket('ws://localhost:8080');
    
    this.ws.onopen = () => {
      console.log('[GameScene] Connected to WebSocket');
      
      // Initialize RTCClient after WebSocket connection is established
      this.rtcClient = new RTCClient(this.ws);
      
      // Notify Arena component that RTCClient is ready
      window.dispatchEvent(new CustomEvent('rtc-client-ready', {
        detail: { rtcClient: this.rtcClient }
      }));

      this.ws.send(
        JSON.stringify({
          type: 'join',
          payload: {
            spaceId: this.spaceId,
          },
        }));

      this.ws.send(JSON.stringify({
        type: 'routerRTPCapabilities'
      }));
    };

    this.ws.onmessage = (event) => {
      this.handleServerMessages(event);
    };

    this.ws.onerror = (error) => {
      console.error('[GameScene] WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('[GameScene] WebSocket connection closed');
      // Notify that RTCClient is no longer available
      window.dispatchEvent(new CustomEvent('rtc-client-disconnected'));
    };
  }

  handleServerMessages(event: MessageEvent) {
    const message: WSMessage = JSON.parse(event.data);
    
    // First, check if this is a WebRTC-related message
    if (this.rtcClient && this.rtcClient.handleSignalingMessage(message)) {
      // Message was handled by RTCClient
      return;
    }

    // Otherwise, handle game-specific messages
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
        //console.log(`User ${movingUserID} moved to ${newX} , ${newY}`);
        const userData = this.users.get(movingUserID);
        if (userData) {
          const newPos = { x: newX*16,y: newY*16 };
          const frame = this.getDirectionFrame(newPos, userData.lastPosition);
          userData.sprite.setPosition(newPos.x, newPos.y);
          userData.sprite.setFrame(frame);
          userData.lastPosition = newPos;
        }
        break;

      case 'user-left':
        const {userId: leavingUserID} = message.payload;
        this.removeUser(leavingUserID);
        console.log(`User ${leavingUserID} left.`);
        break;

      case 'proximity-group-update':
        const {groupId, token, members, action} = message.payload;
        console.log(`Proximity group update : ${action} , \n token : ${token} | groupId : ${groupId} | members : ${members}`);
        localStorage.setItem('proximityToken',token); //just storing token for now
        //event dispatching to show the UI bar
        window.dispatchEvent(new CustomEvent('proximity-group-update', {
          detail: {token, groupId, members, action}
        }));
        break;
    }
  }

  //Calculate the direction
  private getDirectionFrame(currentPos: {x: number; y: number}, lastPos: {x: number; y: number}) {
    const dx = currentPos.x - lastPos.x;
    const dy = currentPos.y - lastPos.y;
    const threshold = 1;
    //debugging
    //console.log(`dx :- ${Math.abs(dx)} \n dy :- ${Math.abs(dy)}`)
    if (Math.floor(Math.abs(dx)) < threshold && Math.floor(Math.abs(dy)) < threshold){
      return -1; //nochange
    }
    else if ( Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 0 : 2;
    } else {
      return dy > 0 ? 3 : 1;
    }
  }

  addUser(userId: string, x: number, y:number){
    if (this.users.has(userId)) return;
    console.log(`Adding Sprite for User ${userId} at ${x}, ${y}`);
    const userSprite = this.physics.add.sprite(x*16, y*16, 'avatar', 3);
    userSprite.setScale(4);
    userSprite.setCollideWorldBounds(true);
    userSprite.setBounce(0);
    userSprite.setSize(14, 16);
    userSprite.setOffset(1,16);
    this.users.set(userId, {
      sprite: userSprite,
      lastPosition: {x :x * 16, y: y * 16}
    });
  }

  removeUser(userId: string) {
    const userData = this.users.get(userId);
    if(userData) {
      userData.sprite.destroy();
      this.users.delete(userId);
      console.log(`User ${userId} left the space`);
    }
  }

  //Clean up fn
  private cleanup() {
    this.users.forEach((userData, userId) => {
      this.removeUser(userId);
    });
    this.users.clear();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'leave',
        payload: { spaceId: this.spaceId }
      }));
      this.ws.close();
    }

    // Remove event listeners
    window.removeEventListener('start-call', () => {});
    window.removeEventListener('end-call', () => {});
    window.removeEventListener('accept-call', () => {});
    window.removeEventListener('decline-call', () => {});
    window.removeEventListener('produce-tracks', () => {});
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
