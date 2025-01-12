import { useEffect } from "react"; 
import Phaser from "phaser"; 
import GameScene from "../game/scenes/GameScene.ts";
import { gameConfig } from "../game/config/GameConfig.ts";
import { useParams } from "react-router-dom";

export const Areana = () => {
   const { spaceId } = useParams<{ spaceId: string }>();

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

    return () => {
      game.destroy(true);
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
    </div>
  );};
