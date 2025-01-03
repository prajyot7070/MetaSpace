import { useEffect } from "react"; import Phaser from "phaser"; import GameScene from "../game/scenes/GameScene.ts";
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
      scene: [GameScene],
    };

    const game = new Phaser.Game(config);

    return () => {
      game.destroy(true);
    };
  }, [spaceId]);

  return <>
    <div>Areana page</div>
    <div id="phaser-game" style={{ width: "800px", height: "600px" }}></div>;
  </>
};
