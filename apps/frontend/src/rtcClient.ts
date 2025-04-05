import { Device } from "mediasoup-client";
import { Producer, Consumer, RtpCapabilities, Transport } from "mediasoup-client/lib/types";

export class RTCClient {
  private ws: WebSocket | null = null;
  public device: Device | null = null;
  private routerRtpCapabilities: RtpCapabilities | null = null;
  private producerTransport: Transport | undefined = undefined;
  private consumerTransport: Transport | undefined = undefined;
  
  constructor(webSocketInstance: WebSocket) {
    this.ws = webSocketInstance;
  }

  // Handle WebRTC signaling messages from the server
  public handleSignalingMessage(message: any) {
    console.log("RTCClient handling message:", message.type);
    
    switch (message.type) {
      case 'rtpCapabilities':
        this.initializeDevice(message.payload.rtpCapabilities)
          .catch(error => {
            console.error("Failed to initialize device:", error);
            window.dispatchEvent(new CustomEvent('rtc-error', {
              detail: { message: "Failed to initialize WebRTC device" }
            }));
          });
        break;
        
      case 'call-response':
        console.log("Call response received with transport params", message.payload);
        this.handleCallResponse(message.payload);
        break;
        
      case 'transport-connected':
        console.log("Transport connected:", message.payload);
        window.dispatchEvent(new CustomEvent('transport-connected', {
          detail: message.payload
        }));
        break;
        
      case 'new-producer':
        // Another user has started producing media
        if (this.device && this.device.loaded) {
          this.sendMessage({
            type: "consume",
            payload: {
              roomId: message.payload.roomId,
              producerId: message.payload.producerId,
              rtpCapabilities: this.device.rtpCapabilities
            }
          });
        }
        break;
        
      case 'consumer-created':
        console.log("Consumer created:", message.payload);
        this.handleConsumerCreated(message.payload);
        break;
        
      case 'producer-created':
        console.log("Producer created:", message.payload);
        window.dispatchEvent(new CustomEvent('producer-created', {
          detail: message.payload
        }));
        break;
        
      case 'call-error':
        console.error("Call error:", message.payload);
        window.dispatchEvent(new CustomEvent('rtc-error', {
          detail: { message: message.payload.message || "Unknown call error occurred" }
        }));
        break;
        
      case 'incoming-call':
        window.dispatchEvent(new CustomEvent('incoming-call', {
          detail: message.payload
        }));
        break;
        
      default:
        // Not a WebRTC-related message
        return false;
    }
    
    // Message was handled by RTCClient
    return true;
  }
  
  private async handleCallResponse(payload: any) {
    try {
      // Create send transport using the parameters from the server
      await this.createSendTransport({
        id: payload.producerTransportParams.id,
        iceParameters: payload.producerTransportParams.iceParameters,
        iceCandidates: payload.producerTransportParams.iceCandidates,
        dtlsParameters: payload.producerTransportParams.dtlsParameters,
        roomId: payload.roomId || "",
        userId: payload.userId || ""
      });
      
      // Create receive transport using the parameters from the server
      await this.createRecvTransport({
        id: payload.consumerTransportParams.id,
        iceParameters: payload.consumerTransportParams.iceParameters,
        iceCandidates: payload.consumerTransportParams.iceCandidates,
        dtlsParameters: payload.consumerTransportParams.dtlsParameters,
        roomId: payload.roomId || "",
        userId: payload.userId || ""
      });
      
      console.log("WebRTC transports created successfully");
      
      // Notify UI that transports are ready
      window.dispatchEvent(new CustomEvent('transports-ready', {
        detail: payload
      }));
    } catch (error) {
      console.error("Failed to create transports:", error);
      window.dispatchEvent(new CustomEvent('rtc-error', {
        detail: { message: "Failed to establish call connection." }
      }));
    }
  }
  
  private async handleConsumerCreated(payload: any) {
    try {
      if (!this.consumerTransport) {
        throw new Error("Consumer transport not initialized");
      }
      
      const consumer = await this.consumerTransport.consume({
        id: payload.consumerId,
        producerId: payload.producerId,
        kind: payload.kind,
        rtpParameters: payload.rtpParameters,
      });
      
      window.dispatchEvent(new CustomEvent('remote-track-added', {
        detail: { track: consumer.track, consumer }
      }));
    } catch (error) {
      console.error("Failed to consume remote track:", error);
    }
  }

  //Initialize the mediasoup device
  public async initializeDevice(rtpCapabilities: RtpCapabilities) {
    try {
      if (!rtpCapabilities) {
        throw new Error("RTP capabilities are required");
      }
      
      this.device = new Device();
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });
      console.log("mediasoup Device initialized");
      
      window.dispatchEvent(new CustomEvent('device-initialized', {
        detail: { device: this.device }
      }));
    } catch (error) {
      console.error("Failed to initialize device:", error);
      throw error;
    }
  }

  //create sendTransport (this comes after the rtc server has created transports and sends back the transport details we use those details to create sendTransport and receiveTransport)
  public async createSendTransport(transportOptions: any) {
    if (!this.device) throw new Error("Device is not initialized");
    console.log(`rtcClient.ts : createSendTransport() - device: ${this.device}`);
    this.producerTransport = this.device?.createSendTransport(transportOptions);
    console.log(`rtcClient.ts : createSendTransport() - producerTransport: ${JSON.stringify(this.producerTransport)}`);
    //subscribe to connect and produce event
    this.producerTransport?.on("connect", async({ dtlsParameters }, callback, errback) => {
      try {
        //send connect-transport
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
	  if (!this.producerTransport) {
	    const error = new Error("Producer transport not initialized");
	    window.dispatchEvent(new CustomEvent('rtc-error', {
	      detail: { message: "Call setup incomplete. Please try again." }
	    }));
	    throw error;
	  }
	
	  try {
	    const producer = await this.producerTransport.produce({
	      track,
	    });
	    console.log("Producer created:", producer.id);
	    return producer;
	  } catch (error) {
	    console.error("Error producing track:", error);
	    throw error;
	  }
	}  

  public async consume(producerId: string, rtpCapabilities: RtpCapabilities) {
    if (!this.consumerTransport) throw new Error("Consumer transport not initialized");
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
              this.ws?.removeEventListener("message", handleConsumerCreated);
            }).catch(reject);
        }
      };
      this.ws?.addEventListener("message", handleConsumerCreated);
    });
  }

  public startCall(token: string, spaceId: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      return;
    }
    
    console.log("Initiating call with token:", token);
    this.sendMessage({
      type: "call",
      payload: {
        token,
        userId: spaceId
      }
    });
  }
  
  public endCall(token: string) {
    this.sendMessage({
      type: "end-call",
      payload: {
        token
      }
    });
  }
  
  public acceptCall(token: string, callerId: string) {
    this.sendMessage({
      type: "accept-call",
      payload: {
        token,
        callerId
      }
    });
  }
  
  public declineCall(token: string, callerId: string) {
    this.sendMessage({
      type: "decline-call",
      payload: {
        token,
        callerId
      }
    });
  }

  // Send a message through the WebSocket
  public sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(`sendMessage : ${JSON.stringify(message)}`);
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("WebSocket not connected");
      window.dispatchEvent(new CustomEvent('rtc-error', {
        detail: { message: "WebSocket not connected" }
      }));
    }
  }
  
  public disconnect() {
    this.ws?.close();
  } 
}
