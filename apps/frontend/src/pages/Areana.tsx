import { useEffect, useState } from "react";
import Phaser from "phaser";
import GameScene from "../game/scenes/GameScene.ts";
import { gameConfig } from "../game/config/GameConfig.ts";
import { useParams } from "react-router-dom";
import OptionsUIBar from "../components/OptionsUIBar.tsx";

export const Areana = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [showUIBar, setShowUIBar] = useState(false);
  const [groupToken, setGroupToken] = useState<string | null>(null);

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

    // Event listener setup (moved to useEffect)
    const handleProximityGroupUpdate = (event: CustomEvent) => {
      const { token, groupId, members, action } = event.detail;
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
  }, [spaceId]); // spaceId is the dependency

  const handleCallClick = async () => {
    if (!groupToken) return;

    
  }

  return (
    <div>
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
      </div>
      <div>
        <OptionsUIBar show={showUIBar} />
      </div>
    </div>
  );
};
