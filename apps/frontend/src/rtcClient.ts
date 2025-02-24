import { Device } from "mediasoup-client";
import { Producer, Consumer, RtpCapabilities, Transport } from "mediasoup-client/lib/types";
import { type } from "os";

export class RTCClient {
  private ws: WebSocket | null = null;
  private device: Device | null = null;
  private routerRtpCapabilities: RtpCapabilities | null = null;
  private producerTransport: Transport | undefined = undefined;
  private consumerTransport: Transport | undefined = undefined;
  
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

  //create sendTransport (this comes after the rtc server has created transports and sends back the transport details we use those details to create sendTransport and receiveTransport)
  public async createSendTransport(transportOptions: any) {
    if (!this.device) throw new Error("Device is no initilized");
    this.producerTransport = this.device?.createSendTransport(transportOptions);
    //subcribe to connect and produce event
    this.producerTransport?.on("connect", async({ dtlsParameters }, callback, errback) => {
      try {
        //send conect-transport
        this.ws?.send(JSON.stringify({
          type: "connect-transport",
          payload: {
            roomId: transportOptions.roomId,
            userId: transportOptions.userId,
            transportId: this.producerTransport?.id,
            dtlsParameters,
          },
        }));
        
        //wait for signaling server to respond with "transport-connected"
        const handleTransportConnected = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          if (message.type == "transport-connected") {
            callback();
            this.ws?.removeEventListener("message", handleTransportConnected);
          }
        };

        this.ws?.addEventListener("message", handleTransportConnected);
      } catch (error: any) {
        errback(error)
        console.error(`rtcClient.ts | Error while sending connect transport : ${error}`);
      }
    });

    this.producerTransport.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
      try {
        // Send produce request to the SFU
         this.ws?.send(JSON.stringify({
          type: "produce",
          payload: {
            roomId: transportOptions.roomId,
            userId: transportOptions.userId,
            transportId: this.producerTransport?.id,
            kind,
            rtpParameters,
          },
        }));

        // Wait for the signaling server to respond with the producer ID
        const handleProducerCreated = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          if (message.type === "producer-created") {
            callback({ id: message.payload.producerId }); // Notify the transport of the producer ID
            this.ws?.removeEventListener("message", handleProducerCreated);
          }
        };

        this.ws?.addEventListener("message", handleProducerCreated);      
      } catch (error: any) {
        errback(error);
      }
    });

    return this.producerTransport;
  }

  public async createRecvTransport(transportOptions: any) {
    if (!this.device) throw new Error("Device not initialized");

    this.consumerTransport = this.device.createRecvTransport(transportOptions);

    // Handle transport events
    this.consumerTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
      try {
        // Send connect-transport request to the signaling server
        this.ws?.send(JSON.stringify({
          type: "connect-transport",
          payload: {
            roomId: transportOptions.roomId,
            userId: transportOptions.userId,
            transportId: this.consumerTransport?.id,
            dtlsParameters,
          },
        }));

        // Wait for the signaling server to respond with "transport-connected"
        const handleTransportConnected = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          if (message.type === "transport-connected") {
            callback(); // Notify the transport that the connection was successful
            this.ws?.removeEventListener("message", handleTransportConnected);
          }
        };

        this.ws?.addEventListener("message", handleTransportConnected);
      } catch (error: any) {
        errback(error); // Notify the transport of the error
      }
    });

    return this.consumerTransport;
  }

  public async produce(track: MediaStreamTrack) {
    if (!this.producerTransport) throw new Error("Producer transport not initialized");

    const producer = await this.producerTransport.produce({
        track,
    });
    console.log("Producer created:", producer.id);
  }  

  public async consume(producerId: string, rtpCapabilities: RtpCapabilities) {
    if (!this.consumerTransport) throw new Error("Consumer transport not inintialized");
    //Send the consume request
    this.ws?.send(JSON.stringify({
      type: "consume",
      payload: {
        roomId: this.consumerTransport.appData.roomId,
        userId: this.consumerTransport.appData.userId,
        transportId: this.consumerTransport.id,
        producerId,
        rtpCapabilities,
      },
    }));

    //wait for the signaling server to respond with consumer details
    return new Promise<Consumer>((resolve, reject) => {
      const handleConsumerCreated = (event: MessageEvent) => {
        const message = JSON.parse(event.data);
        if (message.type == "consumer-created") {
          this.consumerTransport?.consume({
            id: message.payload.consumerId,
            producerId: message.payload.producerId,
            kind: message.payload.kind,
            rtpParameters: message.payload.rtpParameters,
          }).then((consumer) => {
              resolve(consumer);
              this.ws?.removeEventListener("message",handleConsumerCreated);
            }).catch(reject);
        }
      };
      this.ws?.addEventListener("message", handleConsumerCreated);
    });

  }

  public disconnect() {
    this.ws?.close();
  } 

}
