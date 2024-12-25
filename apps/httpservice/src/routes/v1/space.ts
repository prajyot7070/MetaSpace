import { Router, Response, Request } from "express";
import client from "@metaSpace/db";
import { error } from "console";
import { json } from "stream/consumers";
const spaceRouter = Router();

//Create a space
spaceRouter.post('/create-space', async (req: Request, res: Response): Promise<any> => {

  const { name , width, height, thumbnail, creatorId }  = req.body;
  //create a new space
  try {
    if (!name || !width || !creatorId) {
      return res.status(400).json({error: "Missing required fields: name , width or height"});
    }
    
    const newSpace = await client.space.create({
      data: {
        name: name,
        width: width,
        height: height || null,
        thumbnail: thumbnail || null,
        creatorId: creatorId 
      },
    });

    return res.status(201).json({msg: "Space created successfully", space: newSpace});
  } catch (e) {
    return res.status(500).json({error: "An error occurred while creaitng the space."});
  }
})

//Delete your own space
spaceRouter.delete('/:spaceId', async (req: Request , res: Response) : Promise<any> => { //DOUBT How  to not use <any> and not throw any error ask someone;

  try {
    const { spaceId }  = req.params;
    if( !spaceId ) {
      return res.status(400).json({error: "Missing spaceId"});
    }
    const deletedSpace = await client.space.delete({
      where: {
        id: spaceId
      }
    });

    return res.status(200).json({msg: "Space deleted successfully", deletedSpace});
  } catch (e) {
    return res.status(500).json({error: "An error occurred while deleting the space."});
  }
})

// Join the space
spaceRouter.get('/join', (req, res) => {

});


// Get space information
spaceRouter.get('/space-info/:spaceId', async (req: Request, res: Response): Promise<any> => {
  const spaceId = req.params;
  try {
    const space = await client.space.findUnique({
      where: {
        id: String(spaceId),
      },
      select: {
        creator: true,
        name: true,
        id: true,
      },
    });
    if (!space) {
      return res.status(404).json({error: "Space not found!"});
    }
    return res.status(200).json({msg: "Space info fetched successfully.", space});
  } catch (e) {
    
  }
});

// Get list of players in the space
spaceRouter.get('/:spaceId/players', async (req: Request, res:Response): Promise<any> =>  {
  const { spaceId } = req.params;
  try {
    // Fetch the space and count the number of users in `currentUsers`
    const space = await client.space.findUnique({
      where: { id: spaceId },
      select: {
        currentUsers: true, // Fetch the currentUsers relation
      },
    });

    if (!space) {
      return res.status(404).json({ error: 'Space not found' });
    }

    // Count the number of active players
    const activePlayerCount = space.currentUsers.length;

    return res.status(200).json({ activePlayers: activePlayerCount });
  } catch (error) {
    console.error('Error fetching active player count:', error);
    res.status(500).json({ error: 'An error occurred while fetching active player count.' });
  }});

export default spaceRouter;

