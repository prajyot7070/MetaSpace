import { WebSocket } from "ws";
import client from "@metaSpace/db";
import { OutgoingMessage } from "./types";
import { RoomManager } from "./RoomManager";
import { userInfo } from "os";


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

  initHandlers(){
    this.ws.on("message",async (data) => {
      const parsedData = JSON.parse(data.toString());
      console.log(parsedData);
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
          RoomManager.getInstance().addUser(spaceId, this);
          this.x = 18;
          this.y = 9;
          this.send({
            type: "space-joined",
            payload: {
              spawn: {
                x: this.x, //TODO : logic to calcualte current pos
                y: this.y
              },
              users: RoomManager.getInstance().rooms.get(spaceId)?.filter(x => x.id !== this.id)?.map((u) => ({id: u.id, x: u.x, y: u.y})) ?? []
            }
          });
          RoomManager.getInstance().broadcast({
          type: "user-joined",
          payload: {
                userId: this.id, 
                x : this.x,
                y: this.y
            }
          }, this, this.spaceId!);
          break;

        case "move":
          const moveX = parsedData.payload.x;
          const moveY = parsedData.payload.y;
          const xDisplacement = Math.abs(this.x - moveX);
          const yDisplacement = Math.abs(this.y - moveY);
          //if ((xDisplacement == 1 && yDisplacement == 0) || (xDisplacement == 0 && yDisplacement == 1) ) {
          this.x = moveX;
          this.y = moveY;
          RoomManager.getInstance().broadcast({
            type: "move",
            payload: {
              userId: this.id,
              x: this.x,
              y: this.y
            }
          }, this, this.spaceId!);
            return;
          //}
          
//          this.send({
//            type: "move-rejected",
//            payload: {
//              x: this.x,
//              y : this.y
//            }
//          })
        break;
          
        default:
          break;
      }
    })
  }

  send(payload: OutgoingMessage) {
    this.ws.send(JSON.stringify(payload));
  }

  destroy() {
    RoomManager.getInstance().broadcast({
      type: "user-left",
      payload: {
        userId: this.id
      }
    }, this, this.spaceId!);
    RoomManager.getInstance().removeUser(this, this.spaceId!);
  }
}
