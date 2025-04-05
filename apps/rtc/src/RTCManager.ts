import WebSocket from "ws";
//import redisManager from "../../redis-service/src";
import { Worker, Router, WebRtcTransport, Transport, Producer, Consumer, RtpCodecCapability, MediaKind } from "mediasoup/node/lib/types";
import { trace } from "console";
import { transferableAbortSignal } from "util";
import { throwDeprecation } from "process";

interface TransportInfo {
  transport: WebRtcTransport;
  producerTransports: Map<string, Transport>; //<userId, Transport>
  consumerTransports: Map<string, Transport>; //<userId, Transport>
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

export class RTCManager {
  private worker: Worker;
  private router?: Router;
  private rooms: Map<string, TransportInfo> = new Map(); //<token, TransportInfo>

  constructor(worker: Worker) {
    this.worker = worker;
    this.initializeRouter();
  }

  private async initializeRouter() {
    const mediaCodecs: RtpCodecCapability[] = [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2.
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
        },
      }
    ];
    this.router = await this.worker.createRouter({mediaCodecs});
  }

  private async createWebRtcTransport(): Promise<WebRtcTransport> {
    const transport = await this.router!.createWebRtcTransport({
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: '127.0.0.1',
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1000000,
    });
    return transport;
  }

  async getRtpCapabilities() {
    return this.router?.rtpCapabilities;
  }

  async createTransport(token: string, userId: string) {
    if (!this.router) throw new Error("Router was not initialized");
    let transportInfo = this.rooms.get(token);
    if (!transportInfo) {
      transportInfo = {
        transport: await this.createWebRtcTransport(),
        producerTransports: new Map(),
        consumerTransports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      };
      this.rooms.set(token, transportInfo);
    }
    const producerTransport = await this.createWebRtcTransport();
    const consumerTransport = await this.createWebRtcTransport();

    transportInfo.producerTransports.set(userId, producerTransport);
    transportInfo.consumerTransports.set(userId, consumerTransport);
    return {
      producerTransportParams : {
      id: producerTransport.id,
      iceParameters: producerTransport.iceParameters,
      iceCandidates: producerTransport.iceCandidates,
      dtlsParameters: producerTransport.dtlsParameters,
      },
      consumerTransportParams : {
        id: consumerTransport.id,
        iceParameters: consumerTransport.iceParameters,
        iceCandidates: consumerTransport.iceCandidates,
        dtlsParameters: consumerTransport.dtlsParameters,
      }
    };
  }

  async connectTransport(roomId: string, userId: string, transportId: string, dtlsParameters: any) {
   const transportInfo = this.rooms.get(roomId); 
    if (!transportInfo) throw new Error("Room not found");

    const transport = transportInfo.producerTransports.get(userId)?.id === transportId    ? transportInfo.producerTransports.get(userId)
    : transportInfo.consumerTransports.get(userId)?.id === transportId
    ? transportInfo.consumerTransports.get(userId)
    : undefined;

    if (!transport) throw new Error("Transport not found");

    await transport.connect({dtlsParameters});

  }

  //Needs to broadcast producerId when new producer is created
  async produce(roomId: string, userId: string, transportId: string, kind: MediaKind, rtpParameters: any) {
    const transportInfo = this.rooms.get(roomId);
    if (!transportInfo) throw new Error("Room not found");

    const producerTransport = transportInfo.producerTransports.get(userId);
    if (!producerTransport || producerTransport.id !== transportId) {
      throw new Error("Producer transport not found");
    }
    const producer = await producerTransport.produce({ kind: kind, rtpParameters: rtpParameters});
    transportInfo.producers.set(producer.id, producer);

    return { producerId: producer.id };
  }

  async consume(roomId: string, userId: string, transportId: string, producerId: string, rtpCapabilities: any) {
    const transportInfo = this.rooms.get(roomId);
    if (!transportInfo) throw new Error("Room not found");
    
    const producer = transportInfo.producers.get(producerId);
    if (!producer) throw new Error("Producer not found");

    if (!this.router!.canConsume({producerId: producer.id, rtpCapabilities: rtpCapabilities})) {
      throw new Error("Cannot consume this producer");
    }

    const consumerTransport = transportInfo.consumerTransports.get(userId);
    if( !consumerTransport || consumerTransport.id !== transportId) {
      throw new Error('Consumer transport not found');
    }
    const consumer = await consumerTransport.consume({
      producerId: producer.id,
      rtpCapabilities: rtpCapabilities,
      paused: true,
    });

    transportInfo.consumers.set(consumer.id, consumer);

    return {
      consumerId: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      producerId: consumer.producerId
    }; 
  }

  async removeUser(roomId: string, userId: string) {
    const transportInfo = this.rooms.get(roomId);
    if (!transportInfo) throw new Error("Room not found");
    //close user's producer transport
    const producerTransport = transportInfo.producerTransports.get(userId);
    if (producerTransport) {
      await producerTransport.close();
      transportInfo.producerTransports.delete(userId);
    }
    //close user's consumer transport
    const consumerTransport = transportInfo.consumerTransports.get(userId);
    if (consumerTransport) {
      await consumerTransport.close();
      transportInfo.consumerTransports.delete(userId);
    } 
  }


  async closeRoom(roomId: string) {
    const transportInfo = this.rooms.get(roomId);
    if (!transportInfo) throw new Error("Room not found");
    for (const transport of transportInfo.producerTransports.values()) {
      await transport.close();
    }
    for (const transport of transportInfo.consumerTransports.values()) {
      await transport.close();
    }
    this.rooms.delete(roomId);
  }

}
