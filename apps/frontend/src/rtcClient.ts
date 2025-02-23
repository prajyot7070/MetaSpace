import { TransitionalOptions } from "axios";
import { Device } from "mediasoup-client";
import { Producer, Consumer, RtpCapabilities, Transport } from "mediasoup-client/lib/types";

export class RTCClient {
  private ws: WebSocket | null = null;
  private device: Device | null = null;
  private routerRtpCapabilities: RtpCapabilities | null = null;
  private producerTransport: Transport | null = null;
  private consumerTransport: Transport | null = null;
  
  constructor() {}

  public connectWebSocket(spaceId: string, onMessage: (message: any) => void) {
    this.ws = new WebSocket('ws://localhost:8080');
    this.ws.onopen = () => {
      console.log("Connected to WebSocket successfully");
      // get mediasoup router's RtpCapabilities
      this.ws?.send(JSON.stringify({type: "routerRTPCapabilities"}));
    };
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        onMessage(message);
      } catch (error) {
        console.error("Error parsing message: ", error);
      }
    };
  }

  //Initialize the mediasoup device
  public async initializeDevice(rtpCapabilities: RtpCapabilities) {
    this.device = new Device();
    await this.device.load({routerRtpCapabilities: rtpCapabilities});
    console.log("mediasoup Device inintialized");
  }

  //Create a webRTC transport
  

}
