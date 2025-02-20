import { useEffect, useState } from "react";
import Phaser from "phaser";
import GameScene from "../game/scenes/GameScene.ts";
//import { Device } from "mediasoup-client";
import { gameConfig } from "../game/config/GameConfig.ts";
import { useParams } from "react-router-dom";
import OptionsUIBar from "../components/OptionsUIBar.tsx";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";

export const Areana = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [showUIBar, setShowUIBar] = useState(false);
  const [groupToken, setGroupToken] = useState<string | null>(null);
  const [Ws, setWs] = useState<WebSocket | null>(null);
  //const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [routerRtpCapabilities, setRouterRTPCapabilities] = useState<RtpCapabilities | null>(null);  
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
    
    //Initialize ws connection with signaling server
    const ws = new WebSocket('ws://localhost:8080');
    setWs(ws);

    //get RtpCapabilities
      ws.onopen = () => {
      console.log("FROM frontend : Connected to WebSocket successfully");
      ws.send(JSON.stringify({ type: "routerRTPCapabilities" }));
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
        case 'rtpCapabilities':
          setRouterRTPCapabilities(message.payload.rtpCapabilities);
          console.log(`rtpCapabilities :- ${JSON.stringify(routerRtpCapabilities)}`);
          break;
        }
      } catch (error) {
        console.error("Error parsing message: ", error);
      };
        
    };

          // Event listener setup (moved to useEffect)
    const handleProximityGroupUpdate = (event: CustomEvent) => {
      const { token, groupId, members, action } = event.detail;
      if (groupToken) { console.log("got groupToken")}
      console.log(`Proximity group update received : token - ${token} \n groupId - ${groupId} \n members - ${members} \n action - ${action}`); // Fixed typo "aciton" to "action"
      if (token) {
        setShowUIBar(true);
        setGroupToken(token);
      } else {
        console.log('Token not received');
      }
    };

    window.addEventListener('proximity-group-update', handleProximityGroupUpdate as EventListener);


    return () => {
      game.destroy(true);
      window.removeEventListener('proximity-group-update', handleProximityGroupUpdate as EventListener); // Important: Remove listener
    };
  }, [spaceId]);

  return (
    <div className="game-container">
      <div>Arena page</div>
      <div id="phaser-game" />
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
      `}</style>
      <div>
      <OptionsUIBar show={showUIBar}/>
      </div>
    </div>
  );};
