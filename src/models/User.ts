import { resolve } from "path";

import { FileStorage } from "@flystorage/file-storage";
import { LocalStorageAdapter } from "@flystorage/local-fs";

import * as platformClasses from "../platforms/index.ts";
import { PlatformId } from "../platforms/index.ts";

import Feed from "./Feed.ts";
import Platform from "./Platform.ts";
import UserData from "./UserData.ts";
import UserLog from "./UserLog.ts";

import UserMapper from "../mappers/UserMapper.ts";

/**
 * User - represents one fairpost user
 *
 * - with one feed
 * - with zero or more platforms
 * - with a private logger for this account, seperate from
 *   the Fairpost logger.
 * - with a mapper to create a dto;
 *
 * Also contains getters and setters for key / value pairs,
 * using a store.
 *
 */

export default class User {
  public id: string;
  public homedir: string = "";
  public feed: Feed | undefined;
  public platforms:
    | {
        [id in PlatformId]?: Platform;
      }
    | undefined = undefined;
  public files: FileStorage;
  public mapper: UserMapper;

  public data: UserData;
  public log: UserLog;
  private static globalFS: FileStorage | undefined = undefined;

  /**
   * Dont call the constructor yourself;
   * instead, call `await User.getUser()`
   * @param id
   */
  constructor(id: string) {
    this.id = id;
    this.homedir = (
      process.env.FAIRPOST_USER_HOMEDIR ?? "users/%user%"
    ).replace("%user%", id);

    this.data = new UserData(this);
    this.log = new UserLog(this);

    switch (process.env.FAIRPOST_FILE_SYSTEM) {
      default: {
        const adapter = new LocalStorageAdapter(
          resolve(import.meta.dirname + "/../../", this.homedir),
        );
        this.files = new FileStorage(adapter);
        this.mapper = new UserMapper(this);
      }
    }
  }

  /**
   * getUser
   *
   * get a new user and do some async checks and loads.
   * @param id - user id
   * @returns new user object
   */
  public static async getUser(id: string): Promise<User> {
    const user = new User(id);
    if (!(await user.files.directoryExists("."))) {
      throw new Error("No such user: " + id);
    }
    await user.data.init();
    await user.log.init();
    return user;
  }

  /**
   * @returns the new user
   */

  public static async createUser(newUserId: string): Promise<User> {
    if (!newUserId.match("^[a-z][a-z0-9_\\-\\.]{3,31}$")) {
      throw new Error(
        "invalid userid: must be between 4 and 32 long, start with a character and contain only (a-z,0-9,-,_,.)",
      );
    }
    if (!User.globalFS) {
      switch (process.env.FAIRPOST_FILE_SYSTEM) {
        default: {
          const adapter = new LocalStorageAdapter(
            resolve(import.meta.dirname + "/../../"),
          );
          User.globalFS = new FileStorage(adapter);
        }
      }
    }
    const log = [] as string[];
    switch (process.env.FAIRPOST_FILE_SYSTEM) {
      default: {
        if (!process.env.FAIRPOST_USER_HOMEDIR) {
          throw new Error("FAIRPOST_USER_HOMEDIR not set in env");
        }
        const src = "etc/skeleton";
        const dst = process.env.FAIRPOST_USER_HOMEDIR.replace(
          "%user%",
          newUserId,
        );
        if (await User.globalFS.directoryExists(dst)) {
          throw new Error("Homedir already exists: " + dst);
        }
        const listing = await User.globalFS.list(src, { deep: true }).toArray();
        for await (const entry of listing) {
          if (entry.type === "directory" || entry.isDirectory) {
            const entrydst = entry.path.replace("etc/skeleton", dst);
            log.push("creating dir " + entrydst);
            await User.globalFS.createDirectory(entrydst);
          }
        }
        for await (const entry of listing) {
          if (entry.type === "file" || entry.isFile) {
            const entrydst = entry.path.replace("etc/skeleton", dst);
            log.push("copying file " + entry.path + " -> " + entrydst);
            await User.globalFS.copyFile(entry.path, entrydst);
          }
        }
      }
    }

    const user = await User.getUser(newUserId);
    user.data.set("settings", "FEED_PLATFORMS", "");
    await user.data.save();
    for (const msg of log) {
      user.log.info(msg);
    }
    user.log.info("User created: " + newUserId);
    return user;
  }

  /**
   * @returns the feed for this user
   */

  public getFeed(): Feed {
    if (!this.feed) {
      this.feed = new Feed(this);
    }
    return this.feed;
  }

  /**
   * Load all available platforms, and set
   * those that are active in the settings,
   * active
   */
  private loadPlatforms(): void {
    this.log.trace("User", "loadPlatforms");
    const platformIds = this.data
      .get("settings", "FEED_PLATFORMS", "")
      .split(",");
    Object.values(platformClasses).forEach((platformClass) => {
      if (typeof platformClass === "function") {
        if (platformIds.includes(platformClass.id())) {
          const platform = new platformClass(this);
          platform.active = true;
          if (this.platforms === undefined) {
            this.platforms = {};
          }
          this.platforms[platform.id] = platform;
        }
      }
    });
  }

  /**
   * Get one platform
   * @param platformId - the slug of the platform
   * @returns platform given by id
   */
  getPlatform(platformId: PlatformId): Platform {
    this.log.trace("User", "getPlatform", platformId);
    if (this.platforms === undefined) {
      this.loadPlatforms();
    }
    const platform = this.platforms?.[platformId];
    if (!platform) {
      throw this.log.error("Unknown or disabled platform: " + platformId);
    }
    return platform;
  }

  /**
   * Get multiple platforms
   * @param platformIds - the slug of the platform
   * @returns platforms given by ids
   */
  getPlatforms(platformIds?: PlatformId[]): Platform[] {
    this.log.trace("User", "getPlatforms", platformIds);
    if (this.platforms === undefined) {
      this.loadPlatforms();
    }
    return platformIds
      ? platformIds.map((platformId) => this.getPlatform(platformId))
      : Object.values(this.platforms ?? {});
  }

  /**
   * Enable a platform on this user
   * @param platformId
   */
  public addPlatform(platformId: PlatformId): void {
    this.log.trace("User", "addPlatform", platformId);
    if (
      Object.values(PlatformId).includes(platformId) &&
      platformId != PlatformId.UNKNOWN
    ) {
      const platformIds = this.data
        .get("settings", "FEED_PLATFORMS", "")
        .split(",");
      if (!platformIds.includes(platformId)) {
        platformIds.push(platformId);
        this.data.set("settings", "FEED_PLATFORMS", platformIds.join(","));
      }
      this.loadPlatforms();
      this.log.info(`Platform ${platformId} enabled for user ${this.id}`);
    } else {
      throw this.log.error("addPlatform: no such platform", platformId);
    }
  }

  /**
   * Disable a platform on this user
   * @param platformId
   */
  public removePlatform(platformId: PlatformId): void {
    this.log.trace("User", "removePlatforms", platformId);
    if (
      Object.values(PlatformId).includes(platformId) &&
      platformId != PlatformId.UNKNOWN
    ) {
      const platformIds = this.data
        .get("settings", "FEED_PLATFORMS", "")
        .split(",");
      const index = platformIds.indexOf(platformId);
      if (index !== -1) {
        platformIds.splice(index, 1);
        this.data.set("settings", "FEED_PLATFORMS", platformIds.join(","));
      }
      this.loadPlatforms();
      this.log.info(`Platform ${platformId} disabled for user ${this.id}`);
    } else {
      throw this.log.error("removePlatform: no such platform", platformId);
    }
  }
}
