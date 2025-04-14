import { useEffect, useState, useRef } from "react";
import Phaser from "phaser";
import GameScene from "../game/scenes/GameScene.ts";
import { gameConfig } from "../game/config/GameConfig.ts";
import { useParams } from "react-router-dom";
import OptionsUIBar from "../components/OptionsUIBar.tsx";
import { resolve } from "path";
import { RTCClient } from '../rtcClient';
import { Turtle } from "lucide-react";

export const Areana = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [showUIBar, setShowUIBar] = useState(false);
  const [groupToken, setGroupToken] = useState<string>('default-group');
  const [isOnCall, setIsOnCall] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [areTransportsReady, setAreTransportsReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const rtcClient = useRef<RTCClient | null>(null);
  const [currentSpaceId, setCurrentSpaceId] = useState<string>('');
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);

  useEffect(() => {
    if (!spaceId) {
      console.error("Space ID is missing");
      return;
    }

    const config = {
      ...gameConfig,
      parent: 'phaser-game',
      scene: [GameScene],
      scale: {
        mode: Phaser.Scale.FIT,
        parent: 'phaser-game',
        width: 800,
        height: 600,
      },
    };

    const game = new Phaser.Game(config);
    game.registry.set('spaceId', spaceId);

    // Set up event listeners for proximity group updates
    const handleProximityGroupUpdate = (event: CustomEvent) => {
      const { token, groupId, members, action } = event.detail;
      console.log("Proximity group update received:", token, groupId, members, action);
      if (token) {
        setShowUIBar(true);
        setGroupToken(token);
      } else {
        console.log('Token not received');
      }
    };

    // Set up RTC event listeners
    const handleRemoteTrackAdded = (event: CustomEvent) => {
      const { track, kind } = event.detail;
      console.log("[Arena] Remote track added:", { kind, trackId: track.id });
      
      if (remoteVideoRef.current) {
        try {
          let stream = remoteVideoRef.current.srcObject as MediaStream;
          if (!stream) {
            stream = new MediaStream();
            remoteVideoRef.current.srcObject = stream;
          }

          // Remove any existing tracks of the same kind
          const existingTracks = stream.getTracks().filter(t => t.kind === kind);
          existingTracks.forEach(t => stream.removeTrack(t));

          // Add the new track
          stream.addTrack(track);
          console.log("[Arena] Added remote track to stream:", { 
            streamId: stream.id, 
            trackKind: track.kind,
            trackEnabled: track.enabled,
            trackMuted: track.muted
          });

          setIsOnCall(true);
        } catch (error) {
          console.error("[Arena] Error handling remote track:", error);
        }
      }
    };

    const handleRTCError = (event: CustomEvent) => {
      setCallError(event.detail.message || "Unknown call error occurred");
    };

    const handleCallStarted = () => {
      console.log("[Arena] Call started");
      setIsOnCall(true);
    };

    const handleTransportConnected = () => {
      console.log("[Arena] Transport connected");
      setAreTransportsReady(true);
    };

    const handleIncomingCall = (event: CustomEvent) => {
      const { token, callerId } = event.detail;
      const acceptCall = confirm(`Incoming call from ${callerId}. Accept?`);
      if (acceptCall) {
        handleAcceptCall(token, callerId);
      } else {
        window.dispatchEvent(new CustomEvent('decline-call', {
          detail: { token, callerId }
        }));
      }
    };
    
    const handleCallEnded = () => {
      console.log("[Arena] Call ended");
      setIsOnCall(false);
      setIsCameraEnabled(false);
      setIsMicEnabled(false);
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      
      if (remoteVideoRef.current?.srcObject) {
        (remoteVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        remoteVideoRef.current.srcObject = null;
      }
    };

    const handleRTCReadyToProduce = async (e: Event) => {
      console.log("Event 'rtc-ready-to-produce' received");
      await new Promise(resolve => setTimeout(resolve, 500));
      // Only produce tracks after transports are ready
      if (streamRef.current) {
        const audioTrack = streamRef.current.getAudioTracks()[0];
        const videoTrack = streamRef.current.getVideoTracks()[0];
        console.log(`Dispatching 'produce-tracks' events`)
        window.dispatchEvent(new CustomEvent('produce-tracks', {
          detail: {
            audioTrack,
            videoTrack
          }
        }));
      } else {
        console.log('Stream is not available');
      }
    };
   
    // Register event listeners
    window.addEventListener('proximity-group-update', handleProximityGroupUpdate as EventListener);
    window.addEventListener('remote-track-added', handleRemoteTrackAdded as EventListener);
    window.addEventListener('rtc-error', handleRTCError as EventListener);
    window.addEventListener('incoming-call', handleIncomingCall as EventListener);
    window.addEventListener('call-ended', handleCallEnded as EventListener);
    window.addEventListener('call-started', handleCallStarted as EventListener);
    window.addEventListener('transport-connected', handleTransportConnected as EventListener);
    window.addEventListener('rtc-ready-to-produce', handleRTCReadyToProduce as EventListener);

    return () => {
      game.destroy(true);
      
      // Clean up media streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // Remove event listeners
      window.removeEventListener('proximity-group-update', handleProximityGroupUpdate as EventListener);
      window.removeEventListener('remote-track-added', handleRemoteTrackAdded as EventListener);
      window.removeEventListener('rtc-error', handleRTCError as EventListener);
      window.removeEventListener('incoming-call', handleIncomingCall as EventListener);
      window.removeEventListener('call-ended', handleCallEnded as EventListener);
      window.removeEventListener('call-started', handleCallStarted as EventListener);
      window.removeEventListener('transport-connected', handleTransportConnected as EventListener);
      window.removeEventListener('rtc-ready-to-produce', handleRTCReadyToProduce as EventListener);
    };
  }, [spaceId]);

  // Update current space ID when it changes
  useEffect(() => {
    if (spaceId) {
      setCurrentSpaceId(spaceId);
    }
  }, [spaceId]);

  const handleStartCall = async (token: string, space: string) => {
    try {
      console.log("[Arena] Starting call process...");
      
      // Request media permissions with audio initially enabled
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      });
      
      console.log("[Arena] Media stream obtained:", stream.id);
      
      // Set local stream
      setLocalStream(stream);
      streamRef.current = stream;
      setIsMicEnabled(true);
      
      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Start the call
      console.log("[Arena] Initiating call with token:", token);
      window.dispatchEvent(new CustomEvent('start-call', {
        detail: { token, spaceId: space }
      }));
      
      // Set call state immediately for caller
      setIsOnCall(true);
      
    } catch (error) {
      console.error("[Arena] Error starting call:", error);
      setCallError(error instanceof Error ? error.message : "Failed to start call");
      
      window.dispatchEvent(new CustomEvent('rtc-error', {
        detail: { error: error instanceof Error ? error.message : "Unknown error" }
      }));
    }
  };

  const toggleCamera = async () => {
    if (!localStream) return;
    
    if (!isCameraEnabled) {
      // Enable camera
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
        
        const videoTrack = videoStream.getVideoTracks()[0];
        if (videoTrack) {
          // Add video track to existing stream
          localStream.addTrack(videoTrack);
          
          // Update local video display
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
          
          setIsCameraEnabled(true);
          
          // Produce the new video track
          if (rtcClient.current) {
            await rtcClient.current.produce(videoTrack);
          }
        }
      } catch (error) {
        console.error("[Arena] Error enabling camera:", error);
        setCallError("Failed to enable camera");
      }
    } else {
      // Disable camera
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.stop(); // Stop the track
        localStream.removeTrack(track); // Remove it from the stream
      });
      
      setIsCameraEnabled(false);
      
      // Update local video display
      if (localVideoRef.current) {
        // Create a new stream with only audio tracks if they exist
        const audioTracks = localStream.getAudioTracks();
        const newStream = new MediaStream(audioTracks);
        localVideoRef.current.srcObject = newStream;
      }
    }
  };

  const toggleMic = async () => {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !isMicEnabled;
      setIsMicEnabled(!isMicEnabled);
      
      if (rtcClient.current) {
        try {
          if (!isMicEnabled) {
            // Re-produce audio track
            await rtcClient.current.produce(audioTrack);
          }
        } catch (error) {
          console.error("Error toggling mic:", error);
          setCallError("Failed to toggle microphone");
        }
      }
    }
  };

  // Wrapper function that matches OptionsUIBar's expected type
  const handleStartCallWrapper = () => {
    if (groupToken && currentSpaceId) {
      handleStartCall(groupToken, currentSpaceId);
    } else {
      setCallError("Missing group token or space ID");
    }
  };

  const handleEndCall = () => {
    // Dispatch event to end call via GameScene
    window.dispatchEvent(new CustomEvent('end-call', {
      detail: {
        token: groupToken
      }
    }));
    
    // Clean up local state
    setIsOnCall(false);
    setIsCameraEnabled(false);
    setIsMicEnabled(false);
    setCallError(null);

    // Stop all tracks in local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
    }

    // Clear local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // Stop and clear remote tracks
    if (remoteVideoRef.current?.srcObject) {
      const remoteStream = remoteVideoRef.current.srcObject as MediaStream;
      remoteStream.getTracks().forEach(track => track.stop());
      remoteVideoRef.current.srcObject = null;
    }
  };

  
  const handleAcceptCall = async (token: string, callerId: string) => {
    if (!spaceId) return;

    try {
      setCallError(null);
      
      // Get user media first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      
      setLocalStream(stream);
      streamRef.current = stream;
      
      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create a promise that resolves when transport is ready
      const waitForTransport = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Transport initialization timed out'));
        }, 10000);

        const handleTransportReady = () => {
          clearTimeout(timeout);
          window.removeEventListener('rtc-ready-to-produce', handleTransportReady);
          resolve();
        };

        window.addEventListener('rtc-ready-to-produce', handleTransportReady);
      });

      // Accept the call
      window.dispatchEvent(new CustomEvent('accept-call', {
        detail: {
          token,
          callerId
        }
      }));

      // Wait for transport to be ready before proceeding
      await waitForTransport;
      console.log("[Arena] Transport ready, proceeding with call");

      setIsOnCall(true);
    } catch (error) {
      console.error(`Failed to accept call: ${error}`);
      setCallError(error instanceof Error ? error.message : "Failed to accept call");
      
      // Clean up partially created stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }
  };


  return (
    <div className="game-container">
      <div>Arena page</div>
      <div id="phaser-game" />
      <div className="video-container">
        {isOnCall && (
          <>
            <div className="local-video-container">
              <video ref={localVideoRef} autoPlay muted className="local-video" />
              <div className="video-label">Local</div>
              <div className="controls">
                <button onClick={toggleCamera} className={`control-button ${isCameraEnabled ? 'enabled' : 'disabled'}`}>
                  {isCameraEnabled ? 'Disable Camera' : 'Enable Camera'}
                </button>
                <button onClick={toggleMic} className={`control-button ${isMicEnabled ? 'enabled' : 'disabled'}`}>
                  {isMicEnabled ? 'Disable Mic' : 'Enable Mic'}
                </button>
              </div>
            </div>
            <div className="remote-video-container">
              <video ref={remoteVideoRef} autoPlay className="remote-video" />
              <div className="video-label">Remote</div>
            </div>
          </>
        )}
      </div>
      {callError && (
        <div className="error-message">
          {callError}
        </div>
      )}
      <OptionsUIBar
        show={showUIBar}
        isOnCall={isOnCall}
        onStartCall={handleStartCallWrapper}
        onEndCall={handleEndCall}
        error={callError}
      />
      <style>{`
        .game-container {
          display: flex;
          flex-direction: column;
          align-items: start;
          width: 100%;
          height: 100vh;
        }
        #phaser-game {
          width: 1080px;
          height: 720px;
        }
        .video-container {
          display: flex;
          gap: 20px;
          margin-top: 10px;
        }
        .local-video-container, .remote-video-container {
          position: relative;
          width: 240px;
          height: 180px;
          border-radius: 8px;
          overflow: hidden;
        }
        .local-video-container {
          border: 3px solid #4CAF50;
        }
        .remote-video-container {
          border: 3px solid #2196F3;
        }
        .local-video, .remote-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background-color: #222;
        }
        .video-label {
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }
        .controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          gap: 10px;
          padding: 8px;
          background: rgba(0, 0, 0, 0.6);
        }
        .control-button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }
        .control-button.enabled {
          background-color: #4CAF50;
          color: white;
        }
        .control-button.disabled {
          background-color: #f44336;
          color: white;
        }
        .control-button:hover {
          opacity: 0.9;
          transform: scale(1.05);
        }
        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 10px;
          margin: 10px 0;
          border-radius: 4px;
          border: 1px solid #f5c6cb;
        }
      `}</style>
    </div>
  );
};
