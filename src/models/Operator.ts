import User from "./User";

/**
 * Operator - represents the user executing an operation or command.
 *
 * It is up to the interface to determine the operator's roles
 * and check if they are properly authenticated.
 *
 */

export default class Operator {
  private cache: {
    [userid: string]: {
      [permission: string]: boolean;
    };
  } = {};

  constructor(
    public id: string = "anonymous",
    private roles: ("admin" | "user" | "anonymous")[] = ["anonymous"],
    private ui: "cli" | "api",
    private authenticated: boolean,
  ) {}
  public validate() {
    if (this.roles.includes("admin") && this.ui !== "cli") {
      throw new Error("Trying to get permissions as admin from api");
    }

    if (!this.authenticated) {
      if (this.roles.includes("admin") || this.roles.includes("user")) {
        throw new Error("Trying to get permissions while unauthenticated");
      }
    }
  }

  public getPermissions(user?: User) {
    const userid = user?.id;
    if (userid && userid in this.cache) {
      return this.cache[userid];
    }
    const permissions = {
      manageUsers: this.authenticated && this.roles.includes("admin"),
      manageFeed:
        !!user &&
        this.authenticated &&
        (this.id === user.id || this.roles.includes("admin")),
      managePlatforms:
        !!user &&
        this.authenticated &&
        (this.id === user.id || this.roles.includes("admin")),
      manageSources:
        !!user &&
        this.authenticated &&
        (this.id === user.id || this.roles.includes("admin")),
      readPosts: !!user,
      managePosts:
        !!user &&
        this.authenticated &&
        (this.id === user.id || this.roles.includes("admin")),
      publishPosts:
        !!user &&
        this.authenticated &&
        (this.id === user.id || this.roles.includes("admin")),
      schedulePosts:
        !!user &&
        this.authenticated &&
        (this.id === user.id || this.roles.includes("admin")),
      manageServer:
        this.authenticated && this.ui === "cli" && this.roles.includes("admin"),
    };
    if (userid) {
      this.cache[userid] = permissions;
    }
    return permissions;
  }
}
