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
      return res.status(400).json({error: "Missing required fields: name , width or creatorId"});
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

//delete space !TEMPORARY : NOT SAFE
spaceRouter.delete("/:userId/:spaceId", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, spaceId } = req.params;

    if (!userId || !spaceId) {
      return res.status(400).json({ error: "Missing userId or spaceId" });
    }

    // Check if the space exists
    const space = await client.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      return res.status(404).json({ error: "Space not found" });
    }

    // Check if the user is the creator of the space
    if (space.creatorId !== userId) {
      return res.status(403).json({ error: "You are not authorized to delete this space" });
    }

    // Delete the space
    const deletedSpace = await client.space.delete({
      where: { id: spaceId },
    });

    return res.status(200).json({ msg: "Space deleted successfully", deletedSpace });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "An error occurred while deleting the space." });
  }
});

// Join the space
spaceRouter.post('/:userId/:spaceId/join', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, spaceId } = req.params;

    if (!userId || !spaceId) {
      return res.status(400).json({ error: "Missing userId or spaceId" });
    }

    // Check if the space exists
    const space = await client.space.findUnique({
      where: { id: spaceId },
      include: { users: true, currentUsers: true }, // Include current and accessible users
    });

    if (!space) {
      return res.status(404).json({ error: "Space not found" });
    }

    // Check if the user is already in the accessible users list
    const userAlreadyInSpace = space.users.some((user) => user.id === userId);

    // Check if the user is already in the `currentUsers` list
    const userAlreadyCurrent = space.currentUsers.some((user) => user.id === userId);

    
    if (!userAlreadyInSpace && !userAlreadyCurrent) {
      await client.space.update({
        where: { id: spaceId },
          data: {
            users: {
              connect: { id: userId },
            },
          currentUsers: {
            connect: { id: userId },
            },
          },
      });
    } else if (!userAlreadyCurrent) {
        await client.space.update({
          where: { id: spaceId },
            data: {
              currentUsers: {
                connect: { id: userId },
              },
            },
        });
    }


    // Update the user's `currentSpace` field
    await client.user.update({
      where: { id: userId },
      data: {
        currentSpace: {
          connect: { id: spaceId },
        },
      },
    });

    return res.status(200).json({ msg: "User joined space successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "An error occurred while joining the space." });
  }
});
  
  // Get spaces created by a user
  spaceRouter.get('/:userId/created-spaces', async (req: Request, res: Response): Promise<any> => {
  const { userId } = req.params;
  
  try {
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const createdSpaces = await client.space.findMany({
      where: { creatorId: userId },
      select: {
        id: true,
        name: true,
        width: true,
        height: true,
        thumbnail: true,
      },
    });

    return res.status(200).json({ spaces: createdSpaces });
  } catch (error) {
    console.error("Error fetching created spaces:", error);
    return res.status(500).json({ error: "An error occurred while fetching spaces created by the user." });
  }
});
  
    
  // Get spaces the user has access to
spaceRouter.get('/:userId/accessible-spaces', async (req: Request, res: Response): Promise<any> => {
  const { userId } = req.params;

  try {
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const accessibleSpaces = await client.space.findMany({
      where: {
        users: {
          some: { id: userId },
        },
      },
      select: {
        id: true,
        name: true,
        width: true,
        height: true,
        thumbnail: true,
        creator: {
          select: { username: true, email: true },
        },
      },
    });

    return res.status(200).json({ spaces: accessibleSpaces });
  } catch (error) {
    console.error("Error fetching accessible spaces:", error);
    return res.status(500).json({ error: "An error occurred while fetching spaces the user has access to." });
  }
});

// Get space information
spaceRouter.get('/space-info/:spaceId', async (req: Request, res: Response): Promise<any> => {
  const { spaceId } = req.params;
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

