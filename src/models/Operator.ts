import User from "./User.ts";
import { FieldMapping, ProcessedFieldMapping } from "../types/index.ts";
import Platform from "../models/Platform.ts";
import UserMapper from "../mappers/UserMapper.ts";
import FeedMapper from "../mappers/FeedMapper.ts";
import SourceMapper from "../mappers/SourceMapper.ts";
import PostMapper from "../mappers/PostMapper.ts";

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
    public ui: "cli" | "api",
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
      manageAccount:
        !!user &&
        this.authenticated &&
        (this.id === user.id || this.roles.includes("admin")),
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
    //user?.log.info(user.id,this.id,this.roles,this.authenticated);
    //user?.log.info(permissions);
    return permissions;
  }

  public getFieldMapping(
    user: User,
    model: string,
    instance?: object,
  ): ProcessedFieldMapping {
    let rawFieldMapping: FieldMapping | undefined = undefined;
    let processedFieldMapping: ProcessedFieldMapping = {};
    switch (model) {
      case "user":
        rawFieldMapping = UserMapper.userMapping;
        break;

      case "feed":
        rawFieldMapping = FeedMapper.feedMapping;
        break;

      case "source":
        rawFieldMapping = SourceMapper.sourceMapping;
        break;

      case "platform":
        if (!instance || !(instance instanceof Platform)) {
          throw user.log.error(
            "Operator.getFieldMapping",
            "Platform is required",
          );
        }
        const platform = instance as Platform;
        rawFieldMapping = platform.mapper.mapping;
        break;

      case "post":
        rawFieldMapping = PostMapper.postMapping;
        break;
    }
    if (!rawFieldMapping) {
      throw user.log.error("Operator.getFieldMapping: no such mapping", model);
    }
    const permissions = this.getPermissions(user);
    for (const fieldName of Object.keys(rawFieldMapping)) {
      const rawField = rawFieldMapping[fieldName];
      const processedField = { ...rawField, get: true, set: true };
      for (const operation of ["get", "set"] as const) {
        if (rawField[operation].includes("any"))
          processedField[operation] = true;
        else if (rawField[operation].includes("none"))
          processedField[operation] = false;
        else if (
          rawField[operation].some(
            (permission) =>
              permission in permissions &&
              permissions[permission as keyof typeof permissions],
          )
        )
          processedField[operation] = true;
      }
      if (processedField["get"]) {
        processedFieldMapping[fieldName] = processedField;
      }
    }
    return processedFieldMapping;
  }
}
