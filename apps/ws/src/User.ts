import { WebSocket } from "ws";
import client from "@metaSpace/db";
import { OutgoingMessage } from "./types";
import { RoomManager } from "./RoomManager";

function getRandomString(length: number) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export class User {
  public id: string;
  private spaceId?: string;
  private userId?: string;
  private x: number;
  private y: number;
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.id = getRandomString(10);
    this.x = 0;
    this.y = 0;
    this.ws = ws;
    this.initHandlers();
  }

  initHandlers() {
    this.ws.on("message", async (data) => {
      const parsedData = JSON.parse(data.toString());
      switch (parsedData.type) {
        case "join":
          const spaceId = parsedData.payload.spaceId; 
          const space = await client.space.findFirst({
            where: {id: spaceId}
          });
          
          if (!space) {
            this.ws.close();
            return;
          }
          
          this.spaceId = spaceId;
          this.x = 10;
          this.y = 12;
          
          // Add user to room manager (this will also initialize proximity state)
          RoomManager.getInstance().addUser(spaceId, this);
          
          // Send initial space state to user
          this.send({
            type: "space-joined",
            payload: {
              spawn: {
                x: this.x,
                y: this.y
              },
              users: RoomManager.getInstance().rooms.get(spaceId)
                ?.filter(x => x.id !== this.id)
                ?.map((u) => ({
                  id: u.id,
                  x: u.getX(),
                  y: u.getY()
                })) ?? []
            }
          });

          // Broadcast join to other users
          RoomManager.getInstance().broadcast({
            type: "user-joined",
            payload: {
              userId: this.id,
              x: this.x,
              y: this.y
            }
          }, this, this.spaceId!);
          break;

        case "move":
          if (!this.spaceId) return;

          const moveX = parsedData.payload.x;
          const moveY = parsedData.payload.y;

          // Update position
          this.x = moveX;
          this.y = moveY;

          RoomManager.getInstance().updateProximityForUser(this, this.spaceId);

          // First broadcast movement to all users in space
          RoomManager.getInstance().broadcast({
            type: "move",
            payload: {
              userId: this.id,
              x: this.x,
              y: this.y
            }
          }, this, this.spaceId);

          break;
          
        default:
          break;
      }
    });
  }

  send(payload: OutgoingMessage) {
    this.ws.send(JSON.stringify(payload));
  }

  destroy() {
    if (this.spaceId) {
      RoomManager.getInstance().broadcast({
        type: "user-left",
        payload: {
          userId: this.id
        }
      }, this, this.spaceId);
      RoomManager.getInstance().removeUser(this, this.spaceId);
    }
  }
  
  getX() {
    return this.x;
  }

  getY() {
    return this.y;
  }
}
