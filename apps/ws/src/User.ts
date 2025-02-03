import { WebSocket } from "ws";
import client from "@metaSpace/db";
import { OutgoingMessage, SignalingMessage } from "./types";
import { RoomManager } from "./RoomManager";
import { UserManager } from "./UserManager";
import redisManager from "redis-service";
import { type } from "os";

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
    UserManager.getInstance().addUser(this);
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

        case "call":
          if (!this.spaceId) return;
          const token = parsedData.payload.token;
          const groupMembers = await redisManager.getGroupMemebers(token);
          if (!groupMembers || !groupMembers.includes(this.id)) {
            this.send({
              type: "call-error",
              payload: {
                message: "Invalid token or not in group",
              }
            });
          }
          
          const rtcResponse = await fetch("http://localhost:3001/create-transport", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token,
              userId: this.id,
              sdp: parsedData.payload.sdp
            })
          });

          const rtcData = await rtcResponse.json();
          //Notify other user's of the group about incoming-call
          for (const memberId of groupMembers) {
            if (memberId !== this.id) {
              const member = UserManager.getInstance().getUser(memberId);
              member?.send({
                type: "incoming-call",
                payload: {
                  token,
                  callerId: this.id, //add usernames later
                }
              });
            }
          }

          this.send({
            type: "call-response",
            payload: {
              sdp: rtcData.sdp,
              transportId: rtcData.transportId
            }
          });
          break;

        case "call-accept":
          const accepttoken = parsedData.payload.token;
          const acceptGroupMembers = await redisManager.getGroupMemebers(token);
          if (!acceptGroupMembers || !acceptGroupMembers.includes(this.id)) {
            this.send({
              type: "call-error",
              payload: {
                message: "Invalid token or not in group",
              }
            });
          }
         
          const acceptResponse = await fetch("http://localhost:3001/create-transport", {
              method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              token: accepttoken,
              userId: this.id,
              sdp: parsedData.payload.sdp
            })
            });
          const acceptData = await acceptResponse.json();
          // Notify others that this user joined
          for (const memberId of acceptGroupMembers) {
            if (memberId !== this.id) {
              const member = UserManager.getInstance().getUser(memberId);
              member?.send({
                type: "user-joined-call",
                payload: {
                  userId: this.id,
                  //userName: this.name
                }
              });
            }
          }

          //send call-accept response
          this.send({
            type: "call-accepted",
            payload: {
              sdp: acceptData.sdp,
              transportId: acceptData.transportId
            }
          });
          break;

        case "call-reject":
          if (!parsedData.payload.token || !parsedData.payload.callerId) return;
        
          const caller = UserManager.getInstance().getUser(parsedData.payload.callerId);
          caller?.send({
            type: "call-rejected",
            payload: {
              userId: this.id,
              //userName: this.name
            }
          });
          break;

        case "connect-transport":
          if (!parsedData.payload.dtslParameters || !parsedData.payload
          .transportId) {
            return this.send({
              type: "transport-error",
              payload: {
                message: "Missing DTLS parameters or transportId",
              }
            });
          }

          const connectResponse = await fetch("http://localhost:3001/connect-transport", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dtlsParameters: parsedData.payload.dtlsParameters,
              transportId: parsedData.payload.transportId
            })
          })

          if (!connectResponse) {
            return this.send({
              type: "transport-error",
              payload: {

                message: "Failed to connect transport"
              }
            });
          }

          this.send({
            type: "transport-connected"
          });
          break;

        case "produce":

          break;

        case "consume":

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
