import { User } from "./User";

export class UserManager {
  private users: Map<string, User>; // <userId, User object>
  private static instance: UserManager;

  private constructor() {
    this.users = new Map();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new UserManager();
    }
    return this.instance;
  }

  addUser(user: User) {
    this.users.set(user.id, user);
  }

  removeUser(userId: string) {
    this.users.delete(userId);
  }

  getUser(userId: string) {
    return this.users.get(userId);
  }
}
