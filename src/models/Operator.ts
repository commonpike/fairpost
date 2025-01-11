import User from "./User";
export default class Operator {
  constructor(
    private id: string = "anonymous",
    private roles: ("admin" | "user" | "anonymous")[] = ["anonymous"],
    private ui: "cli" | "api",
    private authenticated: boolean,
  ) {
    // if role = admin && ui != cli throw error
  }
  public getPermissions(user?: User) {
    // if role != anonymous && !authenticated throw error
    return {
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
  }
}
