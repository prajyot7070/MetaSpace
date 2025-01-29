import { throws } from "assert";
import { Redis } from "ioredis";
import { PrimaryExpression } from "typescript";

export class RedisManager {
  private readonly GROUP_TOKEN_PREFIX = "room:token:";
  private redis: Redis;
  private readonly TOKEN_EXPIRY = 60*60*24; //24hr 

  constructor(config: {
    host: string;
    port: number;
  }) {
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error :' , err);
    });

    this.redis.on('connect', () => {
      console.log('Successfully connected to Redis');
    });
  }

  //storing group token and members
  async storeGroupToken(token: string, membersIds: string[]): Promise<void> {
    const key = this.GROUP_TOKEN_PREFIX+token;
    try {
      const multi = this.redis.multi();
      multi.sadd(key, membersIds);
      multi.expire(key, this.TOKEN_EXPIRY);
      await multi.exec();
      console.log(`Stored group ${token} with members:`, membersIds);
    } catch (error) {
      console.error('Error while storing group token: ', error)
      throw error;
    }
  }

  //adding members to same group
  async addGroupMember(token: string, membersIds: string[]): Promise<void> {
    const key = this.GROUP_TOKEN_PREFIX+token;
    try {
      await this.redis.sadd(key, membersIds);
      await this.redis.expire(key, this.TOKEN_EXPIRY);      
      console.log(`Added group ${token} with members:`, membersIds);
    } catch (error) {
      console.error('Error adding group members:', error);
      throw error;
    }
  }

  //remove members from a group
  async removeGroupMembers(token: string, membersIds: string[]): Promise<void> {
    const key = this.GROUP_TOKEN_PREFIX+token;
    try {
      await this.redis.srem(key, membersIds);
      console.log(`Removed group ${token} with members:`, membersIds);

    } catch (error) {
      console.error('Error while removing members from group : ',error);
      throw error;
    }
  }

  //get all group members (rtc mein use hoga ye function)
  async getGroupMemebers(token:string): Promise<string[]> {
    const key = this.GROUP_TOKEN_PREFIX+token;
    try {
      return await this.redis.smembers(key);
    } catch (error) {
      console.error('Error getting group members: ', error);
      throw error;
    }
  }

  //delete entire group token and members
  async deleteGroup(token: string): Promise<void> {
    const key = this.GROUP_TOKEN_PREFIX+token;
    try {
     await this.redis.del(key);
     console.log('Deleted Group with token : ', key);
    } catch (error) {
      console.error('Error while deleting group: ', error);
      throw error;
    }
  }
  
  //cleanup
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
