import { WebSocket } from "ws";
import client from "@metaSpace/db";
import { OutgoingMessage, SignalingMessage } from "./types";
import { RoomManager } from "./RoomManager";
import { UserManager } from "./UserManager";
import { type } from "os";
import redisManager from "redis-service";

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
  //private userId?: string;
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
          //console.log(`Inside case 'move' | this.id - ${this.id}`);

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

        case "routerRTPCapabilities":
    try {
        const rtpCapabilitiesResponse = await fetch("http://localhost:3001/routerRTPCapabilities"); // Get the response
        if (!rtpCapabilitiesResponse.ok) { // Check for HTTP errors
            throw new Error(`HTTP error! status: ${rtpCapabilitiesResponse.status}`);
        }

        const rtpCapabilities = await rtpCapabilitiesResponse.json(); // Parse the JSON data!!!

        //console.log(`FROM User.ts rtpCapabilities :- ${JSON.stringify(rtpCapabilities)}`); // Now you'll see the actual data

        this.send({
            type: "rtpCapabilities",
            payload: {
                rtpCapabilities: rtpCapabilities, // Send the parsed JSON data
            }
        });
    } catch (error) {
        console.error("Error fetching or parsing rtpCapabilities:", error);
        this.send({
            type: "rtpCapabilities-error",
            payload: {
                message: "Error while fetching rtpCapabilities", // Send the actual error message
            }
        });
    }
    break;        

        case "call":
          console.error("REACHED THE Signaling server");
          //if (!this.spaceId) console.error('spaceId empty');
          const token = parsedData.payload.token;
          const groupMembers = await redisManager.getGroupMemebers(token);
          console.log(`token : ${token} | groupMembers : ${groupMembers} | this.id : ${this.id}`);
          if (!groupMembers || !groupMembers.includes(this.id)) {
            console.error("groupMembers or token is Missing");
            this.send({
              type: "call-error",
              payload: {
                message: "Invalid token or not in group",
              }
            });
          }
          console.log(`Signaling server : call request | token : ${token} | groupMembers: ${groupMembers} | userId : ${this.id}`);
          const rtcResponse = await fetch("http://localhost:3001/create-transport", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId: token, // prev- token | after- roomId:token - 1:27pm
              userId: this.id,
              //sdp: parsedData.payload.sdp
            })
          });

          const rtcData = await rtcResponse.json();

          //testing logs
          if (rtcData) {console.log(`Signaling server : transport created!`);}

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
              producerTransportParams: rtcData.producerTransportParams,
              consumerTransportParams: rtcData.consumerTransportParams
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
              roomId: accepttoken,
              userId: this.id,
              //sdp: parsedData.payload.sdp
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
              producerTransportParams: acceptData.producerTransportParams,
              consumerTransportParams: acceptData.consumerTransportParams
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
          .transportId || !parsedData.payload.token) {
            return this.send({
              type: "transport-error",
              payload: {
                message: "Missing DTLS parameters, transportId or token",
              }
            });
          }

          const connectResponse = await fetch("http://localhost:3001/connect-transport", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId: parsedData.payload.token,
              userId: this.id,
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
          if (!this.spaceId) return;
          const { roomId, userId, transportId, kind, rtpParameters } = parsedData.payload;
          try {
            //send the produce req to rtc
            const response = await fetch("http://localhost:3001/produce", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({
                roomId,
                userId,
                transportId,
                kind,
                rtpParameters,
              }),
            });

            if (!response) throw new Error("Failed to produce media");

            const data = await response.json();

            this.send({
              type: "produce-created",
              payload: {
                producerId: data.producerId,
              },
            });
          } catch (error) {
            this.send({
              type: "produce-error",
              payload: {
                message: "Failed to produce media",
              },
            });
          }
          break;

        case "consume":
          if (!this.spaceId) return;

          const { roomId: consumeRoomId, userId: consumeUserId, transportId: consumeTransportId, producerId, rtpCapabilities } = parsedData.payload;

          try {
            //send req to rtc
            const response = await fetch("http:localhost:3001/consume", {
              method: "POST",
              headers: {"Content-Type":"application/json"},
              body: JSON.stringify({
                roomtId: consumeRoomId,
                userId: consumeUserId,
                transportId: consumeTransportId,
                producerId,
                rtpCapabilities,
              }),
            });

            if (!response) throw new Error("Failed to get consumer");

            const data = await response.json();
            
            this.send({
              type: "consumer-created",
              payload: {
                consumerId: data.consumerId,
                producerId: data.producerId,
                kind: data.kind,
                rtpParameters: data.rtpParameters,
              },
            });
          } catch (error) {
            console.error("Error consuming media: ", error); 
          }
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
