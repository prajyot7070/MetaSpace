import { StringLiteralLike } from "typescript";
import * as crypto from 'crypto';
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

interface ProximityGroup {
  groupId: string;
  anchor: string;
  members: Set<string>;
  token: string;
  lastActive: number;
}

interface GroupUpdateMessage {
  type: "proximity-group-update";
  payload: {
    groupId:string;
    token: string;
    members: string[];
    action: "added" | "removed" | "dissolved";
  }
}

export class RoomManager {

  public rooms: Map<string, User[]>; //<roomId, list of User's in that room>
  private partitionBoundaries: Map<string, VirtualPartition>; // <partitionId, partition>
  private proximityStates: Map<string,ProximityState>; // <userId, ProximityState> i.e { nearbyUsers, lastPosition}
  private proximityGroups: Map<string, ProximityGroup>; //<groupId, ProximityGroup>
  private userGroupMap: Map<string, string>; // <userId, Set<GroupId>>
  private static instance: RoomManager | null = null;

  private constructor() {
    this.rooms = new Map();
    this.proximityStates = new Map();
    this.proximityGroups = new Map();
    this.userGroupMap = new Map();
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
    }
    this.rooms.set(spaceId, [...(this.rooms.get(spaceId) ?? []), user]);
    this.proximityStates.set(user.id, {
      nearbyUsers: new Set(),
      lastPosition: { x: user.getX(), y: user.getY() }
    });

    //initial check for Proximity when user is added
    this.updateProximityForUser(user, spaceId);
    return;
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

  //notify group updates 
  private notifyGroupUpdate(group: ProximityGroup, action: "added" | "removed" | "dissolved") {
    const message: GroupUpdateMessage = {
      type: "proximity-group-update",
      payload: {
        groupId: group.groupId,
        token: group.token,
        members: Array.from(group.members),
        action
      }
    };

    Array.from(group.members).forEach(memberId => {
    // Find the user in their current space
    const userSpaces = Array.from(this.rooms.entries());
    const userSpace = userSpaces.find(([spaceId, users]) => 
      users.some(u => u.id === memberId)
    );

    if (userSpace) {
      const user = userSpace[1].find(u => u.id === memberId);
      user?.send(message);
    }
  });
  }

  //Check if user is part of group and return the groupId
  public checkUserGroup(userId: string) {
    return this.userGroupMap.get(userId) || null;
  }

  
  //create user group with leader and assigns token to all members
  private createOrUpdateGroup(anchorUser: User, otherUserId: string): ProximityGroup {
    //check if anchorUser is already in a group and add otherUser to that group
    const existingGroupId = this.checkUserGroup(anchorUser.id);
    if (existingGroupId) {
      console.log("Adding user to group");
      const existingGroup = this.proximityGroups.get(existingGroupId);
      existingGroup?.members.add(otherUserId);
      this.userGroupMap.set(otherUserId, existingGroupId);
      this.notifyGroupUpdate(existingGroup!, "added");
      return existingGroup!;
    }
    console.log('Creating a group')
    const group: ProximityGroup = {
      groupId: this.generateToken(),
      anchor: anchorUser.id,
      members: new Set([anchorUser.id, otherUserId]),
      token: this.generateToken(),
      lastActive: Date.now(),
    };
    this.proximityGroups.set(group.groupId, group);
    // Explicitly map users to their group
    this.userGroupMap.set(anchorUser.id, group.groupId);
    this.userGroupMap.set(otherUserId, group.groupId);
    
    this.notifyGroupUpdate(group, "added");
    console.log(`Group created!!!`);
    return group;
  }

  private generateToken(){
    return crypto.randomBytes(8).toString('hex');
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
//    console.log(`Inside the updateProximityForUser()`);  
    const spaceUsers = this.rooms.get(spaceId) ?? [];
    const nearbyUserIds = new Set<string>();
    
    spaceUsers.forEach(otherUser => {
      if (otherUser.id === user.id) return;
      const otherUserPartition = this.getUserPartition(otherUser.getX(), otherUser.getY());
      if (otherUserPartition === userPartition) {
        const distance = this.calculateDistance(user, otherUser);
        const isNearBy = distance <= threshold;
        const wasNearBy = currentState.nearbyUsers.has(otherUser.id);
        if (isNearBy) {
          nearbyUserIds.add(otherUser.id);
        }
        //update the otherUser's state and notify
        const otherUsersState = this.proximityStates.get(otherUser.id);
        if (otherUsersState) {
          const otherWasNearBy = otherUsersState.nearbyUsers.has(user.id);
          if (isNearBy && !otherWasNearBy) {
            otherUsersState.nearbyUsers.add(user.id);
            otherUser.send({
              type: "nearby-users-updated",
              payload: {
                nearby: Array.from(otherUsersState.nearbyUsers),
                added: [user.id],
                removed: []
              }
            });
          } else if (!isNearBy && wasNearBy) {
            otherUsersState.nearbyUsers.delete(user.id);
            otherUser.send({
              type: "nearby-users-updated",
              payload: {
                nearby: Array.from(otherUsersState.nearbyUsers),
                added: [],
                removed: [user.id]
              }
            });
          }
        }
      } 
    });
    //detect changes in the nearby users 
    const added = [...nearbyUserIds].filter(id => !currentState.nearbyUsers.has(id));
    const removed = [...currentState.nearbyUsers].filter(id => !nearbyUserIds.has(id));
    
    //Handle added users
    added.forEach(addedUserId => {
      console.log(`added users : ${added}`)
      console.log(`Checking proximituy group for added users ${addedUserId}`)
      if (user.id < addedUserId) {
        const addeUserGroupId = this.checkUserGroup(addedUserId);
        
        if (!addeUserGroupId) {
          console.log(`Creating group between ${user.id} and ${addedUserId}`)
          this.createOrUpdateGroup(user, addedUserId);
        }

      }  
    });

    //Handle removed users
    removed.forEach(removedUserId => {
      console.log(`removed users : ${removed}`)
      const removedUserGroupId = this.checkUserGroup(removedUserId);
      console.log(`removedUserGroupId :- ${removedUserGroupId}`);
      if (removedUserGroupId) {
        const removedUserGroup = this.proximityGroups.get(removedUserGroupId)!;
      
      if (removedUserGroup) {
        removedUserGroup.members.delete(removedUserId);
        this.notifyGroupUpdate(removedUserGroup!, "removed");
          console.log(`Removed user ${removedUserId} from ${removedUserGroup.groupId}`);
      }
      if (removedUserGroup.members.size < 2) {
        this.proximityGroups.delete(removedUserGroupId!);
        this.notifyGroupUpdate(removedUserGroup!,"dissolved");
        console.log(`Dissolving group ${removedUserGroup?.groupId}`);
      } 
      }
    })

    if(added.length > 0 || removed.length > 0) {
      //update the state
      currentState.nearbyUsers = nearbyUserIds;
      currentState.lastPosition = {x: user.getX(), y: user.getY()};
      //notify the current user
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

  }
