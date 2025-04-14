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
  const [remoteStream] = useState<MediaStream>(() => new MediaStream());

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

    // Listen for RTCClient initialization
    const handleRTCClientReady = (event: CustomEvent) => {
      console.log("[Arena] RTCClient is ready");
      rtcClient.current = event.detail.rtcClient;
    };

    const handleRTCClientDisconnected = () => {
      console.log("[Arena] RTCClient disconnected");
      rtcClient.current = null;
      setIsOnCall(false);
      setCallError("WebSocket connection lost");
    };

    window.addEventListener('rtc-client-ready', handleRTCClientReady as EventListener);
    window.addEventListener('rtc-client-disconnected', handleRTCClientDisconnected);
    
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
    const handleRemoteTrackAdded = async (event: CustomEvent) => {
      const { track, kind } = event.detail;
      console.log("[Arena] Remote track received:", {
        kind,
        id: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings()
      });

      if (!remoteVideoRef.current) {
        console.error("[Arena] Remote video element not found");
        return;
      }

      try {
        // Get or create MediaStream
        let stream = remoteVideoRef.current.srcObject as MediaStream;
        if (!stream) {
          console.log("[Arena] Creating new MediaStream for remote video");
          stream = new MediaStream();
          remoteVideoRef.current.srcObject = stream;
        }

        // Check if we already have a track of this kind
        const existingTracks = stream.getTracks().filter(t => t.kind === kind);
        if (existingTracks.length > 0) {
          console.log("[Arena] Removing existing tracks of kind:", kind);
          existingTracks.forEach(t => {
            stream.removeTrack(t);
            t.stop();
          });
        }

        // Add the new track
        stream.addTrack(track);
        console.log("[Arena] Added track to remote stream:", {
          streamTracks: stream.getTracks().map(t => ({
            id: t.id,
            kind: t.kind,
            enabled: t.enabled,
            settings: t.getSettings()
          }))
        });

        // For video tracks, ensure the video element is playing
        if (kind === 'video') {
          console.log("[Arena] Processing video track");
          
          // Ensure video element is properly configured
          remoteVideoRef.current.autoplay = true;
          remoteVideoRef.current.playsInline = true;
          
          // Wait for track to be ready
          await new Promise<void>((resolve) => {
            const checkTrackReady = () => {
              if (track.readyState === 'live') {
                track.removeEventListener('ended', checkTrackReady);
                track.removeEventListener('unmute', checkTrackReady);
                resolve();
              }
            };
            
            track.addEventListener('ended', checkTrackReady);
            track.addEventListener('unmute', checkTrackReady);
            
            // Also resolve if track is already live
            if (track.readyState === 'live') {
              resolve();
            }
            
            // Set a timeout in case track never becomes ready
            setTimeout(resolve, 2000);
          });
          
          console.log("[Arena] Track ready state:", track.readyState);
          
          // Try to play the video
          try {
            console.log("[Arena] Attempting to play remote video...");
            await remoteVideoRef.current.play();
            console.log("[Arena] Remote video playback started successfully");
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              console.log("[Arena] Previous play attempt was interrupted, retrying...");
              await new Promise(resolve => setTimeout(resolve, 500));
              try {
                await remoteVideoRef.current.play();
                console.log("[Arena] Remote video playback started successfully on retry");
              } catch (retryError) {
                console.error("[Arena] Failed to play remote video after retry:", retryError);
              }
            } else {
              console.error("[Arena] Error playing remote video:", error);
            }
          }
        }

        setIsOnCall(true);
      } catch (error) {
        console.error("[Arena] Error handling remote track:", error);
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
      console.log("[Arena] Event 'rtc-ready-to-produce' received");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (streamRef.current) {
        console.log("[Arena] Current stream tracks:", streamRef.current.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          muted: t.muted
        })));
        
        const audioTrack = streamRef.current.getAudioTracks()[0];
        const videoTrack = streamRef.current.getVideoTracks()[0];
        
        if (audioTrack || videoTrack) {
          console.log("[Arena] Dispatching produce-tracks event with:", {
            hasAudio: !!audioTrack,
            hasVideo: !!videoTrack
          });
          
 	      window.dispatchEvent(new CustomEvent('produce-tracks', {
 	        detail: {
 	          audioTrack,
 	          videoTrack
 	        }
 	      }));
 	    } else {
          console.warn("[Arena] No tracks available to produce");
        }
      } else {
        console.warn("[Arena] Stream is not available for production");
      }
 	  };
   
    // Register event listeners
    window.addEventListener('proximity-group-update', handleProximityGroupUpdate as EventListener);
    
    // Create a properly typed event handler for consumer-track-ready
    const handleConsumerTrackReady = (e: Event) => {
      if (e instanceof CustomEvent) {
        console.log("[Arena] consumer-track-ready event received", e);
        handleRemoteTrackAdded(e).catch(error => {
          console.error("[Arena] Error in handleRemoteTrackAdded:", error);
        });
      }
    };
    
    window.addEventListener('consumer-track-ready', handleConsumerTrackReady);
    window.addEventListener('rtc-error', handleRTCError as EventListener);
    window.addEventListener('incoming-call', handleIncomingCall as EventListener);
    window.addEventListener('call-ended', handleCallEnded as EventListener);
    window.addEventListener('call-started', () => {
      console.log("[Arena] Call started event received");
      handleCallStarted();
    });
    window.addEventListener('transport-connected', () => {
      console.log("[Arena] Transport connected event received");
      handleTransportConnected();
    });
    window.addEventListener('rtc-ready-to-produce', async (e) => {
      console.log("[Arena] Ready to produce event received", e);
      await handleRTCReadyToProduce(e);
    });

    // Log when stream is created
    if (remoteVideoRef.current) {
      remoteVideoRef.current.onloadedmetadata = () => {
        console.log("[Arena] Video metadata loaded:", {
          videoWidth: remoteVideoRef.current?.videoWidth,
          videoHeight: remoteVideoRef.current?.videoHeight,
          readyState: remoteVideoRef.current?.readyState
        });
      };

      remoteVideoRef.current.onplay = () => {
        console.log("[Arena] Video playback started");
      };

      remoteVideoRef.current.onpause = () => {
        console.log("[Arena] Video playback paused");
      };
    }

    return () => {
      game.destroy(true);
      
      // Clean up media streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // Remove event listeners
      window.removeEventListener('proximity-group-update', handleProximityGroupUpdate as EventListener);
      window.removeEventListener('consumer-track-ready', handleConsumerTrackReady as EventListener);
      window.removeEventListener('rtc-error', handleRTCError as EventListener);
      window.removeEventListener('incoming-call', handleIncomingCall as EventListener);
      window.removeEventListener('call-ended', handleCallEnded as EventListener);
      window.removeEventListener('call-started', handleCallStarted as EventListener);
      window.removeEventListener('transport-connected', handleTransportConnected as EventListener);
      window.removeEventListener('rtc-ready-to-produce', handleRTCReadyToProduce as EventListener);
      window.removeEventListener('rtc-client-ready', handleRTCClientReady as EventListener);
      window.removeEventListener('rtc-client-disconnected', handleRTCClientDisconnected);
    };
  }, [spaceId]);

  // Update current space ID when it changes
  useEffect(() => {
    if (spaceId) {
      setCurrentSpaceId(spaceId);
    }
  }, [spaceId]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      console.log("[Arena] Initial remote stream attached to video element");
    }
  }, [remoteStream]);

  const handleStartCall = async () => {
    try {
      console.log("[Arena] Starting call...");
      console.log("[Arena] Local video element status:", {
        exists: !!localVideoRef.current,
        element: localVideoRef.current
      });

      if (!rtcClient.current) {
        throw new Error("RTC client not initialized. Please wait for connection to be established.");
      }

      if (!groupToken || !currentSpaceId) {
        throw new Error("Missing group token or space ID");
      }

      const constraints = {
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("[Arena] Got local media stream:", {
        tracks: stream.getTracks().map(t => ({
          id: t.id,
          kind: t.kind,
          enabled: t.enabled,
          settings: t.getSettings()
        }))
      });

      if (!localVideoRef.current) {
        throw new Error("Local video element not available");
      }

      // Clear any existing stream
      if (localVideoRef.current.srcObject) {
        const oldStream = localVideoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
      }

      // For caller: Enable both video and audio by default
      stream.getVideoTracks().forEach(track => {
        track.enabled = true;
        console.log("[Arena] Set video track enabled for caller:", true);
      });
      
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log("[Arena] Set audio track enabled for caller:", true);
      });

      setIsCameraEnabled(true);
      setIsMicEnabled(true);

      // Set up new local stream
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true; // Mute local video to prevent echo
      console.log("[Arena] Setting up local video element...");
      
      try {
        await localVideoRef.current.play();
        console.log("[Arena] Local video playback started successfully");
      } catch (playError) {
        console.error("[Arena] Error playing local video:", playError);
      }

      // Clear any existing remote stream
      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject) {
          const oldStream = remoteVideoRef.current.srcObject as MediaStream;
          oldStream.getTracks().forEach(track => track.stop());
        }
        remoteVideoRef.current.srcObject = new MediaStream();
      }

      setLocalStream(stream);
      streamRef.current = stream;

      await rtcClient.current.startCall(groupToken, currentSpaceId);
      setIsOnCall(true);
    } catch (error) {
      console.error("[Arena] Error starting call:", error);
      setCallError(error instanceof Error ? error.message : "Failed to start call");
      
      // Clean up if we got a stream but failed later
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }
  };

  const toggleCamera = async () => {
    if (!localStream) return;
    
    try {
      if (!isCameraEnabled) {
        // Enable camera
        console.log("[Arena] Enabling camera");
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
          }
        });
        
        const videoTrack = videoStream.getVideoTracks()[0];
        if (videoTrack) {
          // Remove any existing video tracks
          localStream.getVideoTracks().forEach(track => {
            track.stop();
            localStream.removeTrack(track);
          });
          
          // Add new video track
          localStream.addTrack(videoTrack);
          console.log("[Arena] Added new video track:", {
            id: videoTrack.id,
            enabled: videoTrack.enabled,
            settings: videoTrack.getSettings()
          });
          
          // Update local video display
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
          
          setIsCameraEnabled(true);
          
          // Produce the new video track
          if (rtcClient.current && isOnCall) {
            console.log("[Arena] Producing new video track");
            await rtcClient.current.produce(videoTrack);
          }
        }
      } else {
        // Disable camera
        console.log("[Arena] Disabling camera");
        const videoTracks = localStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.stop();
          localStream.removeTrack(track);
          console.log("[Arena] Removed video track:", track.id);
        });
        
        setIsCameraEnabled(false);
        
        // Update local video display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
      }
    } catch (error) {
      console.error("[Arena] Error toggling camera:", error);
      setCallError("Failed to toggle camera");
    }
  };

  const toggleMic = async () => {
    if (!localStream) return;
    
    try {
      console.log("[Arena] Toggling microphone:", !isMicEnabled);
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicEnabled;
        console.log("[Arena] Audio track state:", {
          id: audioTrack.id,
          enabled: audioTrack.enabled,
          muted: audioTrack.muted
        });
        setIsMicEnabled(!isMicEnabled);
      } else if (!isMicEnabled) {
        // If no audio track exists and we want to enable, create new one
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newAudioTrack = audioStream.getAudioTracks()[0];
        localStream.addTrack(newAudioTrack);
        console.log("[Arena] Added new audio track:", {
          id: newAudioTrack.id,
          enabled: newAudioTrack.enabled
        });
        setIsMicEnabled(true);
        
        // Produce the new audio track
        if (rtcClient.current && isOnCall) {
          console.log("[Arena] Producing new audio track");
          await rtcClient.current.produce(newAudioTrack);
        }
      }
    } catch (error) {
      console.error("[Arena] Error toggling microphone:", error);
      setCallError("Failed to toggle microphone");
    }
  };

  // Wrapper function that matches OptionsUIBar's expected type
  const handleStartCallWrapper = () => {
    if (groupToken && currentSpaceId) {
      handleStartCall();
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
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });

      // For callee: Enable only audio by default, video starts disabled
      stream.getVideoTracks().forEach(track => {
        track.enabled = false;
        console.log("[Arena] Set video track enabled for callee:", false);
      });
      
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log("[Arena] Set audio track enabled for callee:", true);
      });

      setIsCameraEnabled(false);
      setIsMicEnabled(true);

      // Ensure we're setting up the local stream properly
      if (localVideoRef.current) {
        // Clear any existing stream
        if (localVideoRef.current.srcObject) {
          const oldStream = localVideoRef.current.srcObject as MediaStream;
          oldStream.getTracks().forEach(track => track.stop());
        }
        
        // Set new local stream
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // Mute local video to prevent echo
        
        try {
          await localVideoRef.current.play();
          console.log("[Arena] Local video playback started in accept call");
        } catch (error) {
          console.error("[Arena] Error playing local video in accept call:", error);
        }
      }
      
      // Clear any existing remote stream
      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject) {
          const oldStream = remoteVideoRef.current.srcObject as MediaStream;
          oldStream.getTracks().forEach(track => track.stop());
        }
        remoteVideoRef.current.srcObject = new MediaStream();
      }
      
      setLocalStream(stream);
      streamRef.current = stream;

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

  // Clean up function to handle component unmount
  useEffect(() => {
    return () => {
      remoteStream.getTracks().forEach(track => {
        track.stop();
        remoteStream.removeTrack(track);
      });
    };
  }, [remoteStream]);

  return (
    <div className="game-container">
      <div>Arena page</div>
      <div id="phaser-game" />
      <div className="video-container">
        <div className="call-status">Call Status: {isOnCall ? 'In Call' : 'Not in Call'}</div>
        {/* Always show video containers for debugging */}
        <>
          <div className="local-video-container">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                backgroundColor: '#000'
              }}
            />
            <div className="video-label">Local</div>
            <div className="controls">
              <button
                onClick={toggleCamera}
                className={`control-button ${isCameraEnabled ? 'enabled' : 'disabled'}`}
              >
                {isCameraEnabled ? 'Disable Camera' : 'Enable Camera'}
              </button>
              <button
                onClick={toggleMic}
                className={`control-button ${isMicEnabled ? 'enabled' : 'disabled'}`}
              >
                {isMicEnabled ? 'Disable Mic' : 'Enable Mic'}
              </button>
            </div>
          </div>
          <div className="remote-video-container">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: '#000'
              }}
            />
            <div className="video-label">Remote</div>
            <div className="debug-info">
              {remoteVideoRef.current && (
                <>
                  <div>Ready State: {remoteVideoRef.current.readyState}</div>
                  <div>
                    Tracks: {remoteVideoRef.current.srcObject instanceof MediaStream
                      ? remoteVideoRef.current.srcObject.getTracks().length
                      : 0}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
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
        .call-status {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
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
