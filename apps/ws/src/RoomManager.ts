import { User } from "./User";
import { OutgoingMessage } from "./types";

interface VirtualPartition {
  topLeft: { x: number; y: number};
  bottomRight: { x: number; y: number};
}

interface ProximityState {
  nearbyUsers: Set<string>;
  lastPosition: {x: number, y: number};
}

export class RoomManager {

  public rooms: Map<string, User[]>; //<roomId, list of User's in that room>
  private partitionBoundaries: Map<string, VirtualPartition>; // <partitionId, partition>
  private proximityStates: Map<string,ProximityState>; // <userId, ProximityState> i.e { nearbyUsers, lastPosition}
  private static instance: RoomManager | null = null;

  private constructor() {
    this.rooms = new Map();
    this.proximityStates = new Map();
    this.partitionBoundaries = new Map();
    //Init prototype room partitionBoundaries
    this.partitionBoundaries.set("room1", {
      topLeft: {x:9, y: 12},
      bottomRight: {x: 74, y: 64}
    });
  } 

  static getInstance() {
    if (!this.instance) {
      this.instance = new RoomManager();
    }
    return this.instance;
  }

  public addUser(spaceId: string, user: User) {
    if (!this.rooms.has(spaceId)){
      this.rooms.set(spaceId, [user]);
      return;
    }
    this.rooms.set(spaceId, [...(this.rooms.get(spaceId) ?? []), user]);
    this.proximityStates.set(user.id, {
      nearbyUsers: new Set(),
      lastPosition: { x: user.getX(), y: user.getY() }
    });

    //initial check for Proximity when user is added
    this.updateProximityForUser(user, spaceId);
  }

  public removeUser(user: User, spaceId: string) {
    if (!this.rooms.has(spaceId)) {
      return;
    }
    const affectedUsers = this.rooms.get(spaceId)?.filter(u => {
      const state = this.proximityStates.get(u.id);
      return state?.nearbyUsers.has(user.id);
      }) ?? [];
      //notify affectedUsers
      affectedUsers.forEach(affectedUser => {
      const state = this.proximityStates.get(affectedUser.id);
      if (state) {
        state.nearbyUsers.delete(user.id);
        affectedUser.send({
          type: "nearby-users-updated",
          payload: {
            nearby: Array.from(state.nearbyUsers),
            added: [],
            removed: [user.id]
          }
        });
      }
    });
    //clean up 
    this.proximityStates.delete(user.id);
    this.rooms.set(spaceId, (this.rooms.get(spaceId)?.filter(u => u.id !== user.id) ?? []));
    }

  public broadcast(message: OutgoingMessage, user: User, roomId: string){
    if (!this.rooms.has(roomId)) {
      return;
    }
    this.rooms.get(roomId)?.forEach((u) => {
      if (u.id !== user.id){
        u.send(message);
      }
    })
  }

  public getUserPartition(x: number, y:number): string | null {
    for(const [partitionId, bounds] of this.partitionBoundaries) {
      if(bounds.topLeft.x <= x && bounds.topLeft.y <= y && bounds.bottomRight.x >= x && bounds.bottomRight.y >= y) {
        return partitionId;
      }
    }
    return null;
  }
  
  public calculateDistance(user1: User, user2: User) {
    return Math.sqrt(
      Math.pow(user1.getX()- user2.getX(), 2) + Math.pow(user1.getY() - user2.getY(), 2)
    );
  }

  public updateProximityForUser(user: User, spaceId: string, threshold: number = 10) {
    if (!this.rooms.has(spaceId)) return;
    const userPartition = this.getUserPartition(user.getX(),user.getY());
    if (!userPartition) return;
    const currentState = this.proximityStates.get(user.id);
    if (!currentState) return;
    console.log(`Inside the updateProximityForUser()`);  
    const spaceUsers = this.rooms.get(spaceId) ?? [];
    const nearbyUserIds = new Set<string>();
    
    spaceUsers.forEach(otherUser => {
      if (otherUser.id === user.id) return;
      const otherUserPartition = this.getUserPartition(otherUser.getX(), otherUser.getY());
      if (otherUserPartition === userPartition) {
        const distance = this.calculateDistance(user, otherUser);
        if (distance <= threshold) {
          nearbyUserIds.add(otherUser.id);

          this.updateSingleUserProximity(otherUser, user, spaceId, threshold);
        }
      } 
    });
    //detect changes in the nearby users 
    const added = [...nearbyUserIds].filter(id => !currentState.nearbyUsers.has(id));
    const removed = [...currentState.nearbyUsers].filter(id => !nearbyUserIds.has(id));
    if(added.length > 0 || removed.length > 0) {
      //update the state
      currentState.nearbyUsers = nearbyUserIds;
      currentState.lastPosition = {x: user.getX(), y: user.getY()};
      //notify the user
      user.send({
        type: "nearby-users-updated",
        payload: {
          nearby: Array.from(nearbyUserIds),
          added: added,
          removed: removed
        }
      });
    }
  }

  public updateSingleUserProximity(targetUser: User, movingUser: User, spaceId: string, threshold:number = 10) {
    const targetUserState = this.proximityStates.get(targetUser.id);
    if (!targetUserState) return;
    const distance = this.calculateDistance(targetUser, movingUser);
    const wasNearby = targetUserState.nearbyUsers.has(movingUser.id);
    //If new user comes into range set proximityState and send response
    if (distance <= threshold && !wasNearby) {
      targetUserState.nearbyUsers.add(movingUser.id);
      targetUser.send({
        type: "nearby-users-updated",
        payload: {
          nearby: Array.from(targetUserState.nearbyUsers),
          added: [movingUser.id],
          removed: []
        }
      })
    } else if (distance >= threshold && wasNearby) { //If user goes out of range update the proximityState and send response
      targetUserState.nearbyUsers.delete(movingUser.id);
      targetUser.send({
        type: "nearby-users-updated",
        payload: {
          nearby: Array.from(targetUserState.nearbyUsers),
          added: [],
          removed: [movingUser.id]
        }
      });
    }
  }

}
