import React, { useState, useEffect, useRef } from 'react';
import { RTCClient } from '../rtcClient';

interface ArenaProps {
  token: string;
  spaceId: string;
}

const Arena: React.FC<ArenaProps> = ({ token, spaceId }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [rtcClient, setRTCClient] = useState<RTCClient | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const ws = new WebSocket('ws://localhost:3001');
    
    // Initialize RTCClient when WebSocket is open
    ws.onopen = () => {
      console.log("[Arena] WebSocket connected");
      setRTCClient(new RTCClient(ws));
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, []);

  // Effect to handle local stream changes
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log("[Arena] Setting up local video element");
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.autoplay = true;
      localVideoRef.current.muted = true;
      localVideoRef.current.playsInline = true;
    }
  }, [localStream]);

  const handleStartCall = async () => {
    try {
      console.log("[Arena] Starting call process...");
      
      // Request media permissions
      console.log("[Arena] Requesting media permissions...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      console.log("[Arena] Media permissions granted, stream obtained:", {
        id: stream.id,
        active: stream.active,
        tracks: stream.getTracks().map(track => ({
          id: track.id,
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted
        }))
      });

      // Set local stream
      console.log("[Arena] Setting local stream...");
      setLocalStream(stream);
      console.log("[Arena] Local stream set successfully");

      // Start the call
      console.log("[Arena] Initiating call with token:", token);
      if (rtcClient) {
        rtcClient.startCall(token, spaceId);
      } else {
        throw new Error("RTCClient not initialized");
      }
    } catch (error) {
      console.error("[Arena] Error starting call:", error);
      window.dispatchEvent(new CustomEvent('rtc-error', {
        detail: { message: "Failed to start call. Please check your camera and microphone permissions." }
      }));
    }
  };

  return (
    <div>
      <div style={{ width: '320px', height: '240px', position: 'relative' }}>
        <video
          ref={localVideoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#000'
          }}
        />
      </div>
      <button onClick={handleStartCall}>Start Call</button>
    </div>
  );
};

export default Arena; 