export interface SignalingMessage {
  type: "call" | "call-accept" | "call-reject" | "connect-transport" | "produce" | "consume";
  payload: {
    token?: string;
    sdp?: any;
    dtlsParameters?: any;
    transportId?: string;
    kind?: string;
    rtpParameters?: any;
    rtpCapabilities?: any;
    producerId?: string;
    callerId?: string;
  };
}

export type OutgoingMessage = any; 
