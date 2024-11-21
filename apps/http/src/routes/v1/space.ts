import { Router } from "express";

const spaceRouter = Router();

// Mock space data
const space = {
  id: 1,
  name: 'Default Space',
  players: [], // List of connected players
};

//Create a space
spaceRouter.post('/create-space', (req, res) => {
  //create a new space
  res.json({msg: "newwww space created"});
})

// Join the space
spaceRouter.get('/join', (req, res) => {
  const user = { username: "mock-user" }; // Replace with authenticated user
  res.json({
    message: `Joined space ${space.name}`,
    space,
    player: user
  });
});

// Get space information
spaceRouter.get('/space-info', (req, res) => {
  res.json(space);
});

// Get list of players in the space
spaceRouter.get('/players', (req, res) => {
  res.json(space.players);
});

export default spaceRouter;
