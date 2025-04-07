import { useEffect, useState, useRef } from "react";
import Phaser from "phaser";
import GameScene from "../game/scenes/GameScene.ts";
import { gameConfig } from "../game/config/GameConfig.ts";
import { useParams } from "react-router-dom";
import OptionsUIBar from "../components/OptionsUIBar.tsx";
import { resolve } from "path";

export const Areana = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [showUIBar, setShowUIBar] = useState(false);
  const [groupToken, setGroupToken] = useState<string | null>(null);
  const [isOnCall, setIsOnCall] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [areTransportsReady, setAreTransportsReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  let stream : MediaStream;
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
      const { track } = event.detail;
      if (remoteVideoRef.current && track) {
        const stream = new MediaStream([track]);
        remoteVideoRef.current.srcObject = stream;
        setIsOnCall(true);
      }
    };

    const handleRTCError = (event: CustomEvent) => {
      setCallError(event.detail.message || "Unknown call error occurred");
    };

    const handleIncomingCall = (event: CustomEvent) => {
      const { token, callerId } = event.detail;
      const acceptCall = confirm(`Incoming call from ${callerId}. Accept?`);
      if (acceptCall) {
        handleAcceptCall(token, callerId);
      } else {
        // Decline the call
        window.dispatchEvent(new CustomEvent('decline-call', {
          detail: { token, callerId }
        }));
      }
    };
    
    const handleCallEnded = () => {
      setIsOnCall(false);
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

    const handleTransportsReady = async (e: Event) => {
 	    console.log("Event 'transports-ready' received");
      const currentStream = streamRef.current;
      await new Promise(resolve => setTimeout(resolve, 100));
 	    // Only produce tracks after transports are ready
 	    if (currentStream) {
 	      const audioTrack = currentStream.getAudioTracks()[0];
 	      const videoTrack = currentStream.getVideoTracks()[0];
 	      console.log(`Dispatching 'produce-tracks' events`)
 	      window.dispatchEvent(new CustomEvent('produce-tracks', {
 	        detail: {
 	          audioTrack,
 	          videoTrack
 	        }
 	      }));
 	    } else {
        console.log(`currentStream is empty : ${currentStream}`)
      }
 	  };
   
    // Register event listeners
    window.addEventListener('proximity-group-update', handleProximityGroupUpdate as EventListener);
    window.addEventListener('remote-track-added', handleRemoteTrackAdded as EventListener);
    window.addEventListener('rtc-error', handleRTCError as EventListener);
    window.addEventListener('incoming-call', handleIncomingCall as EventListener);
    window.addEventListener('call-ended', handleCallEnded as EventListener);
    window.addEventListener('transports-ready', handleTransportsReady);

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
    };
  }, [spaceId]);

  const handleStartCall = async () => {
    if (!groupToken || !spaceId) {
      setCallError("Missing required parameters for call");
      return;
    }

    try {
      setCallError(null);
      
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support media devices. Please use a modern browser.");
      }
      
      console.log("Requesting media permissions...");
      
      // Try to get user media with more specific error handling
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: true 
        });
        console.log(`handleStartCall : stream - ${JSON.stringify(stream.getTracks())}`);
      } catch (err) {
        // Handle specific permission errors
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            throw new Error("Camera/microphone access denied. Please allow access to use this feature.");
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            throw new Error("No camera or microphone found. Please check your device connections.");
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            throw new Error("Your camera or microphone is already in use by another application.");
          }
        }
        throw err; // Re-throw if it's another type of error
      }
      console.log(`setting localStream`);
      setLocalStream(stream);
      streamRef.current = stream;
      console.log(`localStream set! :- ${localStream}`);
      
      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Dispatch event to start call via GameScene
      window.dispatchEvent(new CustomEvent('start-call', {
        detail: {
          token: groupToken,
          spaceId
        }
      }));
      
//      // Once we have media, dispatch event to produce tracks
//      const audioTrack = stream.getAudioTracks()[0];
//      const videoTrack = stream.getVideoTracks()[0];
//      
//      window.dispatchEvent(new CustomEvent('produce-tracks', {
//        detail: {
//          audioTrack,
//          videoTrack
//        }
//      }));
//      
      // Set call as initiated
      setIsOnCall(true);
      
    } catch (error) {
      console.error("Failed to start call:", error);
      setCallError(error instanceof Error ? error.message : "Failed to access camera/microphone");
      
      // Clean up any partially created stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      
      setIsOnCall(false);
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
    setCallError(null);

    // Stop local media streams
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // Stop remote media streams
    if (remoteVideoRef.current?.srcObject) {
      (remoteVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      remoteVideoRef.current.srcObject = null;
    }
  };

  const handleAcceptCall = async (token: string, callerId: string) => {
    if (!spaceId) return;

    try {
      setCallError(null);
      
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support media devices. Please use a modern browser.");
      }
      
      // Try to get user media with error handling
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: true 
        });
      } catch (err) {
        // Handle specific permission errors
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            throw new Error("Camera/microphone access denied. Please allow access to use this feature.");
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            throw new Error("No camera or microphone found. Please check your device connections.");
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            throw new Error("Your camera or microphone is already in use by another application.");
          }
        }
        throw err; // Re-throw if it's another type of error
      }
      
      setLocalStream(stream);
      
      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Dispatch event to accept call via GameScene
      window.dispatchEvent(new CustomEvent('accept-call', {
        detail: {
          token,
          callerId
        }
      }));
      
      // Once we have media, dispatch event to produce tracks
//      const audioTrack = stream.getAudioTracks()[0];
//      const videoTrack = stream.getVideoTracks()[0];
//      
//      window.dispatchEvent(new CustomEvent('produce-tracks', {
//        detail: {
//          audioTrack,
//          videoTrack
//        }
//      }));
      
      // Set call as initiated
      setIsOnCall(true);
      
    } catch (error) {
      console.error("Failed to accept call:", error);
      setCallError(error instanceof Error ? error.message : "Failed to access camera/microphone");
      
      // Clean up any partially created stream
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
            <video ref={localVideoRef} autoPlay muted className="local-video" />
            <video ref={remoteVideoRef} autoPlay className="remote-video" />
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
        onStartCall={handleStartCall}
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
          gap: 10px;
          margin-top: 10px;
        }
        .local-video {
          width: 240px;
          height: 180px;
          border: 1px solid #ccc;
          background-color: #222;
        }
        .remote-video {
          width: 320px;
          height: 240px;
          border: 1px solid #ccc;
          background-color: #222;
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
