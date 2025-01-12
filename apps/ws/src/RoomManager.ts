import { matchesGlob } from "path";
import { User } from "./User";
import { OutgoingMessage } from "./types";

interface virtualPartition {
  topLeft: { x: number; y: number};
  bottomRight: { x: number; y: number};
}

export class RoomManager {

  rooms: Map<string, User[]>; //<roomId, list of User's in that room>
  partitionBoundaries: Map<string, virtualPartition>; // <partitionId, partition>
  static instance: RoomManager;

  private constructor() {
    this.rooms = new Map();
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
  }

  public removeUser(user: User, spaceId: string) {
        if (!this.rooms.has(spaceId)) {
            return;
        }
        this.rooms.set(spaceId, (this.rooms.get(spaceId)?.filter((u) => u.id !== user.id) ?? []));
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
  
  //TODO : can be optimized by not trying to find each User's partition every time
  public calculateDistances(user: User, spaceId: string) {
    const userPartition = this.getUserPartition(user.getX(), user.getY());
    console.log(`User ${user.id}'s partition : - ${userPartition}`)
    if (!userPartition || !this.rooms.has(spaceId)) {
      return [];
    } 
    const spaceUsers = this.rooms.get(spaceId) ?? [];
    console.log(`Users in same space :- ${spaceUsers}`)
    const distances: {userId: string; distance: number}[] = [];
    spaceUsers.forEach((otherUser) => {
      if (otherUser.id === user.id) return;
      const otherUserPartition = this.getUserPartition(otherUser.getX(), otherUser.getY());
      const distance = Math.sqrt(
        Math.pow(user.getX() - otherUser.getX(), 2) +
        Math.pow(user.getY() - otherUser.getY(), 2)
      );
      distances.push({userId: otherUser.id, distance: distance});
    });
    return distances; 
  }


  

}
