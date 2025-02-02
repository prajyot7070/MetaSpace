import WebSocket from "ws";
import redisManager from "../../redis-service/src";
import { Worker, Router, WebRtcTransport } from "mediasoup/node/lib/types";

//[ ] - Signaling functionality that user sends the token , req (CALL / CALLANS) , SDP (OFFER / ANSWER ), ICE verify token process request
//[ ] - Create transport , connect transport
//[ ] - produce , consume media
//[ ] - 

export class RTCManager {

  constructor(worker: Worker) {
  }

  async createTransport() {
  }
}
