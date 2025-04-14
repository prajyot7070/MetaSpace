import { Device } from "mediasoup-client";
import { Producer, Consumer, RtpCapabilities, Transport } from "mediasoup-client/lib/types";

export class RTCClient {
  private ws: WebSocket | null = null;
  public device: Device | null = null;
  private routerRtpCapabilities: RtpCapabilities | null = null;
  private producerTransport: Transport | undefined = undefined;
  private consumerTransport: Transport | undefined = undefined;
  private consumers: Map<string, Consumer> = new Map();
  private onVideoTrack?: (track: MediaStreamTrack) => void;
  private onAudioTrack?: (track: MediaStreamTrack) => void;
  private pendingProducers: Array<{roomId: string, producerId: string}> = [];
  
  constructor(webSocketInstance: WebSocket) {
    this.ws = webSocketInstance;
  }

  private transportCallbacks: Map<string, { 
    resolve: () => void, 
    reject: (error: Error) => void 
  }> = new Map();

  // New map to handle producer callbacks
  private producerCallbacks: Map<string, { 
    resolve: (producerId: { id: string }) => void, 
    reject: (error: Error) => void 
  }> = new Map();

  // Helper method to handle transport connection responses
  private handleTransportConnected(message: any) {
    const { transportId } = message.payload;
    const callback = this.transportCallbacks.get(transportId);
    if (callback) {
      callback.resolve();
      this.transportCallbacks.delete(transportId);
    } else {
      console.warn(`No callback found for transport ${transportId}`);
    }
  }

  // New helper method to handle producer creation responses
  private handleProducerCreated(message: any) {
    const { transportId, producerId } = message.payload;
    console.log(`Producer created with id: ${producerId} for transport: ${transportId}`);
    const callback = this.producerCallbacks.get(transportId);
    if (callback) {
      callback.resolve({ id: producerId });
      this.producerCallbacks.delete(transportId);
    } else {
      console.warn(`No callback found for transport ${transportId}`);
    }
  }

  private async withTransportTimeout(
	  transportId: string,
	  operation: Promise<void>,
	  timeoutMs = 10000
	  ): Promise<void> {
	  const timeout = new Promise<void>((_, reject) => 
	    setTimeout(() => reject(new Error('Transport operation timed out')), timeoutMs)
	  );
	  
	  try {
	    await Promise.race([operation, timeout]);
	  } catch (error) {
	    this.transportCallbacks.delete(transportId);
	    throw error;
	  }
  }

  // Handle WebRTC signaling messages from the server
  public handleSignalingMessage(message: any) {
    console.log("[RTCClient] Handling message:", message.type);
    
    switch (message.type) {
      case 'rtpCapabilities':
        this.initializeDevice(message.payload.rtpCapabilities)
          .then(() => {
            console.log("[RTCClient] Device initialized successfully");
          })
          .catch(error => {
            console.error("[RTCClient] Failed to initialize device:", error);
            window.dispatchEvent(new CustomEvent('rtc-error', {
              detail: { message: "Failed to initialize WebRTC device" }
            }));
          });
        break;
        
      case 'call-response':
        console.log("[RTCClient] Call response received with transport params", message.payload);
        this.handleCallResponse(message.payload)
          .then(() => {
            // Process any pending producers after transports are created
            if (this.pendingProducers.length > 0) {
              console.log("[RTCClient] Processing pending producers:", this.pendingProducers);
              this.pendingProducers.forEach(producer => {
                if (this.device?.rtpCapabilities && this.consumerTransport) {
                  this.sendMessage({
                    type: "consume",
                    payload: {
                      roomId: producer.roomId,
                      userId: this.consumerTransport.appData.userId,
                      transportId: this.consumerTransport.id,
                      producerId: producer.producerId,
                      rtpCapabilities: this.device.rtpCapabilities
                    }
                  });
                }
              });
              this.pendingProducers = [];
            }
          });
        break;
        
      case 'call-accepted':
        console.log("[RTCClient] Call accepted message received:", message.payload);
        this.handleCallResponse(message.payload);
        break;
        
      case 'transport-connected':
        console.log("[RTCClient] Transport connected message received:", message.payload);
        const transportId = message.payload.transportId;
        const callback = this.transportCallbacks.get(transportId);
        if (callback) {
          console.log("[RTCClient] Calling connect callback for transport", transportId);
          callback.resolve();
          this.transportCallbacks.delete(transportId);
        } else {
          console.warn("[RTCClient] No callback found for transport", transportId);
        }
        window.dispatchEvent(new CustomEvent('transport-connected', {
          detail: message.payload
        }));
        break;
        
      case 'transport-error':
        console.error("[RTCClient] Transport error received:", message.payload);
        const errorTransportId = message.payload.transportId;
        const errorCallback = this.transportCallbacks.get(errorTransportId);
        if (errorCallback) {
          errorCallback.reject(new Error(message.payload.message || "Transport connection failed"));
          this.transportCallbacks.delete(errorTransportId);
        }
        window.dispatchEvent(new CustomEvent('rtc-error', {
          detail: { message: message.payload.message || "Transport connection failed" }
        }));
        break;
        
      case 'new-producer':
        console.log("[RTCClient] New producer message received:", message.payload);
        if (!this.device?.loaded) {
          console.error("[RTCClient] Device not initialized");
          return;
        }
        if (!this.consumerTransport) {
          console.log("[RTCClient] Consumer transport not initialized, queuing producer");
          this.pendingProducers.push({
            roomId: message.payload.roomId,
            producerId: message.payload.producerId
          });
          return;
        }

        // Check if device has RTP capabilities
        if (!this.device.rtpCapabilities) {
          console.error("[RTCClient] Device RTP capabilities not available");
          return;
        }

        const { roomId, producerId } = message.payload;
        console.log("[RTCClient] Sending consume request with:", {
          roomId,
          userId: this.consumerTransport.appData.userId,
          transportId: this.consumerTransport.id,
          producerId,
          rtpCapabilities: this.device.rtpCapabilities
        });
        
        this.sendMessage({
          type: "consume",
          payload: {
            roomId,
            userId: this.consumerTransport.appData.userId,
            transportId: this.consumerTransport.id,
            producerId,
            rtpCapabilities: this.device.rtpCapabilities
          }
        });
        break;
        
      case 'consumer-created':
        console.log("[RTCClient] Consumer created message received:", message.payload);
        if (!message.payload || !message.payload.consumerId) {
          console.error("[RTCClient] Invalid consumer-created message:", message.payload);
          return false;
        }
        this.handleConsumerCreated(message.payload)
          .catch(error => {
            console.error("[RTCClient] Error handling consumer:", error);
            window.dispatchEvent(new CustomEvent('rtc-error', {
              detail: { message: "Failed to handle remote media" }
            }));
          });
        break;
        
      case 'producer-created':
        console.log("[RTCClient] Producer created message received:", message.payload);
        this.handleProducerCreated(message);
        window.dispatchEvent(new CustomEvent('producer-created', {
          detail: message.payload
        }));
        break;
        
      case 'call-error':
        console.error("[RTCClient] Call error message received:", message.payload);
        window.dispatchEvent(new CustomEvent('rtc-error', {
          detail: { message: message.payload.message || "Unknown call error occurred" }
        }));
        break;
        
      case 'incoming-call':
        console.log("[RTCClient] Incoming call message received:", message.payload);
        window.dispatchEvent(new CustomEvent('incoming-call', {
          detail: message.payload
        }));
        break;
        
      case 'user-joined-call':
        console.log("[RTCClient] User joined call:", message.payload);
        window.dispatchEvent(new CustomEvent('user-joined-call', {
          detail: message.payload
        }));
        break;
        
      default:
        console.log("[RTCClient] Unhandled message type:", message.type);
        return false;
    }
    
    return true;
  }
  
  private async handleCallResponse(payload: any) {
    try {
      console.log("[RTCClient] Starting transport creation process...");
      console.log("[RTCClient] Received transport parameters:", JSON.stringify(payload, null, 2));
      
      // Create send transport using the parameters from the server
      console.log("[RTCClient] Creating send transport...");
      const sendTransport = this.createSendTransport({
        id: payload.producerTransportParams.id,
        iceParameters: payload.producerTransportParams.iceParameters,
        iceCandidates: payload.producerTransportParams.iceCandidates,
        dtlsParameters: payload.producerTransportParams.dtlsParameters,
        roomId: payload.roomId,
        userId: payload.userId,
        appData: {
          roomId: payload.roomId,
          userId: payload.userId
        }
      });
      console.log("[RTCClient] Send transport created with ID:", sendTransport.id);
      
      // Create receive transport using the parameters from the server
      console.log("[RTCClient] Creating receive transport...");
      const recvTransport = this.createRecvTransport({
        id: payload.consumerTransportParams.id,
        iceParameters: payload.consumerTransportParams.iceParameters,
        iceCandidates: payload.consumerTransportParams.iceCandidates,
        dtlsParameters: payload.consumerTransportParams.dtlsParameters,
        roomId: payload.roomId,
        userId: payload.userId,
        appData: {
          roomId: payload.roomId,
          userId: payload.userId
        }
      });
      console.log("[RTCClient] Receive transport created with ID:", recvTransport.id);
      
      // Process any pending producers
      if (this.pendingProducers.length > 0) {
        console.log("[RTCClient] Processing pending producers:", this.pendingProducers.length);
        for (const producer of this.pendingProducers) {
          console.log("[RTCClient] Processing queued producer:", producer);
          if (this.device?.rtpCapabilities && this.consumerTransport) {
            this.sendMessage({
              type: "consume",
              payload: {
                roomId: producer.roomId,
                userId: this.consumerTransport.appData.userId,
                transportId: this.consumerTransport.id,
                producerId: producer.producerId,
                rtpCapabilities: this.device.rtpCapabilities
              }
            });
          } else {
            console.error("[RTCClient] Cannot process queued producer - missing capabilities or transport");
          }
        }
        this.pendingProducers = [];
      } else {
        console.log("[RTCClient] No pending producers to process");
      }

      // Notify UI that transports are ready to produce
      window.dispatchEvent(new CustomEvent('rtc-ready-to-produce', {
        detail: payload
      }));

      console.log("[RTCClient] Transport creation completed successfully");
    } catch (error) {
      console.error("[RTCClient] Failed to create transports:", error);
      window.dispatchEvent(new CustomEvent('rtc-error', {
        detail: { message: "Failed to establish call connection." }
      }));
    }
  }
  
  private async handleConsumerCreated(data: any) {
    try {
      console.log("[RTCClient] Handling consumer creation:", {
        consumerId: data.consumerId,
        producerId: data.producerId,
        kind: data.kind,
        hasRtpCapabilities: !!this.device?.rtpCapabilities
      });

      if (!this.consumerTransport) {
        console.error("[RTCClient] Cannot create consumer - transport not initialized");
        return;
      }

      if (!this.device?.rtpCapabilities) {
        console.error("[RTCClient] Cannot create consumer - RTP capabilities not initialized");
        return;
      }

      const { producerId, consumerId, kind, rtpParameters } = data;
      
      // Check if we already have this consumer
      if (this.consumers.has(consumerId)) {
        console.log("[RTCClient] Consumer already exists:", consumerId);
        return;
      }

      console.log("[RTCClient] Creating consumer with parameters:", {
        id: consumerId,
        producerId,
        kind,
        rtpParametersType: rtpParameters.type
      });

      const consumer = await this.consumerTransport.consume({
        id: consumerId,
        producerId,
        kind,
        rtpParameters,
        appData: { ...data.appData }
      });

      console.log("[RTCClient] Consumer created successfully:", {
        consumerId: consumer.id,
        kind: consumer.kind,
        track: consumer.track?.enabled
      });

      this.consumers.set(consumer.id, consumer);

      // Resume the consumer immediately
      try {
        console.log("[RTCClient] Resuming consumer:", consumer.id);
        await consumer.resume();
        console.log("[RTCClient] Consumer resumed successfully");

        // Send consumer-ready message to server
        await this.sendMessage({
          type: "consumer-ready",
          payload: {
            roomId: data.roomId,
            userId: data.userId,
            consumerId: consumer.id,
            producerId: data.producerId
          }
        });

        // Only dispatch event if we have a track
        if (consumer.track) {
          console.log("[RTCClient] Dispatching track event:", {
            trackId: consumer.track.id,
            kind: consumer.track.kind,
            enabled: consumer.track.enabled,
            readyState: consumer.track.readyState
          });

          window.dispatchEvent(new CustomEvent('consumer-track-ready', {
            detail: {
              track: consumer.track,
              kind: consumer.kind
            }
          }));
        } else {
          console.warn("[RTCClient] Consumer created without track");
        }
      } catch (error) {
        console.error("[RTCClient] Error resuming consumer:", error);
        throw error;
      }

    } catch (error) {
      console.error("[RTCClient] Failed to create consumer:", error);
      window.dispatchEvent(new CustomEvent('rtc-error', {
        detail: { message: "Failed to create consumer" }
      }));
    }
  }

  ///Initialize the mediasoup device
  public async initializeDevice(rtpCapabilities: RtpCapabilities) {
    try {
      console.log("[RTCClient] Starting device initialization...");
      if (!rtpCapabilities) {
        throw new Error("RTP capabilities are required");
      }
      
      console.log("[RTCClient] Creating new device instance...");
      this.device = new Device();
      
      console.log("[RTCClient] Loading device with RTP capabilities:", rtpCapabilities);
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });
      console.log("[RTCClient] Device initialized successfully");
      
      window.dispatchEvent(new CustomEvent('device-initialized', {
        detail: { device: this.device }
      }));

      return this.device;
    } catch (error) {
      console.error("[RTCClient] Failed to initialize device:", error);
      throw error;
    }
  }

  //create sendTransport (this comes after the rtc server has created transports and sends back the transport details we use those details to create sendTransport and receiveTransport)
  private createSendTransport(transportOptions: any): Transport {
    console.log("[RTCClient] Starting send transport creation...");
    if (!this.device) throw new Error("Device is not initialized");
    
    // Add STUN/TURN servers to transport options
    const enhancedOptions = {
      ...transportOptions,
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
//        { urls: "stun:stun1.l.google.com:3478" },
//        { urls: "stun:stun2.l.google.com:3478" },
//        { urls: "stun:stun3.l.google.com:3478" },
//        {
//          urls: "turn:numb.viagenie.ca",
//          username: "webrtc@live.com",
//          credential: "muazkh"
//        },
//        {
//          urls: [
//            "turn:turn.bistri.com:80",
//            "turn:turn.bistri.com:443",
//            "turn:turn.bistri.com:3478"
//          ],
//          username: "homeo",
//          credential: "homeo"
//        }
      ],
      iceTransportPolicy: 'all'
    };
    
    console.log("[RTCClient] Creating send transport with options:", JSON.stringify(enhancedOptions, null, 2));
    this.producerTransport = this.device?.createSendTransport(enhancedOptions);
    console.log("[RTCClient] Send transport created with ID:", this.producerTransport?.id);

    // Set up connect handler
    this.producerTransport?.on("connect", async({ dtlsParameters }, callback, errback) => {
      try {
        console.log("[RTCClient] Send transport connect event triggered");
        const transportId = this.producerTransport!.id;
        
        // Store callback for later use
        this.transportCallbacks.set(transportId, {
          resolve: callback,
          reject: errback
        });
        
        // Get roomId and userId from transport options
        const roomId = transportOptions.roomId || transportOptions.appData?.roomId;
        const userId = transportOptions.userId || transportOptions.appData?.userId;
        
        if (!roomId || !userId) {
          throw new Error("Missing roomId or userId in transport options");
        }
        
        // Send connect-transport request via WebSocket
        console.log("[RTCClient] Sending connect-transport request for send transport", transportId);
        const connectMessage = {
          type: "connect-transport",
          payload: {
            roomId,
            userId,
            transportId: transportId,
            dtlsParameters,
          },
        };
        console.log("[RTCClient] Connect message details:", JSON.stringify(connectMessage, null, 2));
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          console.error("[RTCClient] WebSocket is not connected");
          errback(new Error('WebSocket is not connected'));
          return;
        }
        
        this.ws.send(JSON.stringify(connectMessage));
        console.log("[RTCClient] Connect message sent successfully");
      } catch (error: any) {
        console.error("[RTCClient] Error in send transport connect event:", error);
        errback(error);
      }
    });

    this.producerTransport.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
      try {
        console.log("[RTCClient] Produce event triggered for kind:", kind);
        const transportId = this.producerTransport!.id;
        
        // Store callback in the map to be resolved when producer-created message is received
        this.producerCallbacks.set(transportId, {
          resolve: callback,
          reject: errback
        });

        // Send produce request to the SFU
        const produceMessage = {
          type: "produce",
          payload: {
            roomId: transportOptions.roomId,
            userId: transportOptions.userId,
            transportId: transportId,
            kind,
            rtpParameters,
          },
        };
        console.log("[RTCClient] Produce message details:", JSON.stringify(produceMessage, null, 2));
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          console.error("[RTCClient] WebSocket is not connected");
          errback(new Error('WebSocket is not connected'));
          return;
        }
        
        this.ws.send(JSON.stringify(produceMessage));
        console.log("[RTCClient] Produce message sent successfully");
      } catch (error: any) {
        console.error("[RTCClient] Error in produce event:", error);
        errback(error);
      }
    });

    return this.producerTransport!;
  }

  public createRecvTransport(transportOptions: any): Transport {
    console.log("[RTCClient] Starting receive transport creation...");
    if (!this.device) throw new Error("Device not initialized");
    
    // Add STUN/TURN servers to transport options
    const enhancedOptions = {
      ...transportOptions,
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
//        { urls: "stun:stun1.l.google.com:3478" },
//        { urls: "stun:stun2.l.google.com:3478" },
//        { urls: "stun:stun3.l.google.com:3478" },
//        {
//          urls: "turn:numb.viagenie.ca",
//          username: "webrtc@live.com",
//          credential: "muazkh"
//        },
//        {
//          urls: [
//            "turn:turn.bistri.com:80",
//            "turn:turn.bistri.com:443",
//            "turn:turn.bistri.com:3478"
//          ],
//          username: "homeo",
//          credential: "homeo"
//        }
      ],
      iceTransportPolicy: 'all'
    };
    
    console.log("[RTCClient] Creating receive transport with options:", JSON.stringify(enhancedOptions, null, 2));
    this.consumerTransport = this.device.createRecvTransport(enhancedOptions);
    console.log("[RTCClient] Receive transport created with ID:", this.consumerTransport.id);

    // Set up connect handler
    this.consumerTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
      try {
        console.log("[RTCClient] Receive transport connect event triggered");
        const transportId = this.consumerTransport!.id;
        
        // Store callback for later use
        this.transportCallbacks.set(transportId, {
          resolve: callback,
          reject: errback
        });
        
        // Get roomId and userId from transport options
        const roomId = transportOptions.roomId || transportOptions.appData?.roomId;
        const userId = transportOptions.userId || transportOptions.appData?.userId;
        
        if (!roomId || !userId) {
          throw new Error("Missing roomId or userId in transport options");
        }
        
        // Send connect-transport request via WebSocket
        console.log("[RTCClient] Sending connect-transport request for receive transport", transportId);
        const connectMessage = {
          type: "connect-transport",
          payload: {
            roomId,
            userId,
            transportId: transportId,
            dtlsParameters,
          },
        };
        console.log("[RTCClient] Connect message details:", JSON.stringify(connectMessage, null, 2));
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          console.error("[RTCClient] WebSocket is not connected");
          errback(new Error('WebSocket is not connected'));
          return;
        }
        
        this.ws.send(JSON.stringify(connectMessage));
        console.log("[RTCClient] Connect message sent successfully");
      } catch (error: any) {
        console.error("[RTCClient] Error in receive transport connect event:", error);
        errback(error);
      }
    });

    return this.consumerTransport;
  }

	public async produce(track: MediaStreamTrack) {
    console.log("[RTCClient] Starting media production...");
    console.log("[RTCClient] Track details:", {
      id: track.id,
      kind: track.kind,
      enabled: track.enabled,
      muted: track.muted
    });

    if (!this.producerTransport) {
      const error = new Error("Producer transport not initialized");
      console.error("[RTCClient] Producer transport not initialized");
      window.dispatchEvent(new CustomEvent('rtc-error', {
        detail: { message: "Call setup incomplete. Please try again." }
      }));
      throw error;
    }

    if (!track) {
      console.error("[RTCClient] Cannot produce - track is invalid");
      throw new Error("Invalid track provided");
    }
    
    try {
      console.log("[RTCClient] Creating producer...");
      const producer = await this.producerTransport.produce({
        track,
      });
      console.log("[RTCClient] Producer created successfully with ID:", producer.id);
      return producer;
    } catch (error) {
      console.error("[RTCClient] Error producing track:", error);
      window.dispatchEvent(new CustomEvent('rtc-error', {
        detail: { message: 'Failed to produce media track' }
      }));
      throw error;
    }
  } 

  public async consume(producerId: string, rtpCapabilities: RtpCapabilities) {
    if (!this.consumerTransport) {
      throw new Error("Consumer transport not initialized");
    }
    
    const transportId = this.consumerTransport.id;
    const userId = this.consumerTransport.appData.userId;
    const roomId = this.consumerTransport.appData.roomId;

    if (!transportId || !userId || !roomId) {
      throw new Error("Missing required transport data");
    }

    console.log("[RTCClient] Sending consume request:", {
      roomId,
      userId,
      transportId,
      producerId
    });

    //Send the consume request
    this.ws?.send(JSON.stringify({
      type: "consume",
      payload: {
        roomId,
        userId,
        transportId,
        producerId,
        rtpCapabilities,
      },
    }));

    //wait for the signaling server to respond with consumer details
    return new Promise<Consumer>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws?.removeEventListener("message", handleConsumerCreated);
        reject(new Error("Consumer creation timed out"));
      }, 10000);

      const handleConsumerCreated = (event: MessageEvent) => {
        const message = JSON.parse(event.data);
        if (message.type === "consumer-created") {
          clearTimeout(timeout);
          if (!message.payload || !message.payload.consumerId) {
            reject(new Error("Invalid consumer data received"));
            return;
          }

          this.consumerTransport?.consume({
            id: message.payload.consumerId,
            producerId: message.payload.producerId,
            kind: message.payload.kind,
            rtpParameters: message.payload.rtpParameters,
          }).then((consumer) => {
              resolve(consumer);
              this.ws?.removeEventListener("message", handleConsumerCreated);
            }).catch(reject);
        } else if (message.type === "consumer-error") {
          clearTimeout(timeout);
          reject(new Error(message.payload.error || "Consumer creation failed"));
          this.ws?.removeEventListener("message", handleConsumerCreated);
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
      type: "call-accept",
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
