import { basename } from "path";
import * as readline from "node:readline/promises";

import * as platformClasses from "../platforms/index.ts";
import { PlatformId } from "../platforms/index.ts";

import Feed from "./Feed.ts";
import Platform from "./Platform.ts";
import GlobalFs from "../services/GlobalFs.ts";
import { UserReport } from "../types/index.ts";

import UserData from "./User/UserData.ts";
import UserFiles from "./User/UserFiles.ts";
import UserLog from "./User/UserLog.ts";
import UserMapper from "../mappers/UserMapper.ts";
import { FieldMapping } from "../types/index.ts";

/**
 * User - represents one fairpost user
 *
 * - with one feed
 * - with zero or more platforms
 * - with a private logger for this account, seperate from
 *   the Fairpost logger.
 * - with a data store for key / value pairs
 * - with a file storage for the homedir
 * - with a mapper to create a dto
 *
 *
 */

export default class User {
  public id: string;
  public homedir: string = "";
  private feed: Feed | undefined;
  private platforms:
    | {
        [id in PlatformId]?: Platform;
      }
    | undefined = undefined;
  public files: UserFiles;
  public mapper: UserMapper;

  public data: UserData;
  public log: UserLog;

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

    this.files = new UserFiles(this);
    this.data = new UserData(this);
    this.log = new UserLog(this);
    this.mapper = new UserMapper(this);
  }

  /**
   * getUsers
   *
   * get all users, but do not init them all the way;
   * filter them for public. This is dumb and heavy now.
   * https://github.com/commonpike/fairpost/issues/135
   * @param publicOnly - wether users should be public
   * @returns new user object
   */
  public static async getUsers(publicOnly: boolean): Promise<User[]> {
    const users: User[] = [];
    const globalfs = new GlobalFs();
    if (!process.env.FAIRPOST_USER_HOMEDIR) {
      throw new Error("FAIRPOST_USER_HOMEDIR not set in env");
    }
    const srcdir = process.env.FAIRPOST_USER_HOMEDIR.replace("%user%", "");
    const listing = await globalfs.list(srcdir).toArray();
    const ids = listing
      .map((entry) => {
        if (entry.isDirectory) {
          return basename(entry.path);
        }
      })
      .filter((id) => id !== undefined);
    for (const id of ids) {
      const user = new User(id);
      await user.files.init();
      await user.data.init();
      if (
        !publicOnly ||
        user.data.get("settings", "IS_PUBLIC", "false") !== "false"
      ) {
        users.push(user);
      }
    }
    return users;
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
    await user.files.init();
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
    const globalfs = new GlobalFs();

    if (!process.env.FAIRPOST_USER_HOMEDIR) {
      throw new Error("FAIRPOST_USER_HOMEDIR not set in env");
    }
    const src = "etc/skeleton";
    const dst = process.env.FAIRPOST_USER_HOMEDIR.replace("%user%", newUserId);
    if (await globalfs.exists(dst)) {
      throw new Error("Homedir already exists: " + dst);
    }
    const log = await globalfs.copyDir(src, dst);
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
   * getReport: return a report for this user.
   *
   * Generating a report may be heavy, so
   * the report is updated as posts are processed
   * and cached in the user data.
   * @returns the report for this user.
   */

  public async getReport(): Promise<UserReport> {
    this.log.trace("User", "getReport");
    try {
      const report = this.data.getObject("cache", "report") as UserReport;
      const platforms = this.getPlatforms();
      const reportedPlatforms = Object.keys(report.platforms);
      if (
        !platforms.every((platform) => reportedPlatforms.includes(platform.id))
      ) {
        throw this.log.error(
          "User",
          "getReport",
          "report is missing a platform, regenerating",
        );
      }
      return report;
    } catch {
      this.log.trace("User", "getReport", "creating new report");
      const report: UserReport = {
        feed: await this.getFeed().getReport(),
        platforms: {},
      };
      for (const platform of this.getPlatforms()) {
        report.platforms[platform.id] = await platform.getReport();
      }
      await this.putReport(report);
      return report;
    }
  }

  /**
   * putReport: save an updated report
   *
   * The report is updated as posts are processed
   * and cached in the user data.
   */

  public async putReport(report: UserReport): Promise<void> {
    this.log.trace("User", "putReport");
    this.data.setObject("cache", "report", report);
    await this.data.save();
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
    let platform = this.platforms?.[platformId];
    if (platform) {
      return platform;
    }

    Object.values(platformClasses).forEach((platformClass) => {
      if (typeof platformClass === "function") {
        if (platformClass.id() === platformId) {
          platform = new platformClass(this);
        }
      }
    });
    if (platform) {
      return platform;
    }
    throw this.log.error("Unknown platform: " + platformId);
  }

  /**
   * Get multiple platforms
   * @param platformIds - the slug of the platform
   * @returns platforms given by ids
   */
  getPlatforms(platformIds?: PlatformId[]): Platform[] {
    this.log.trace("User", "getPlatforms", platformIds ?? "");
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
   * @returns the enabled platform
   */
  public async addPlatform(platformId: PlatformId): Promise<Platform> {
    this.log.trace("User", "addPlatform", platformId);
    if (
      Object.values(PlatformId).includes(platformId) &&
      platformId != PlatformId.UNKNOWN
    ) {
      const platforms = this.data.get("settings", "FEED_PLATFORMS", "");
      const platformIds = platforms ? platforms.split(",") : [];
      if (!platformIds.includes(platformId)) {
        platformIds.push(platformId);
        this.data.set("settings", "FEED_PLATFORMS", platformIds.join(","));
        await this.data.save();
      }
      this.loadPlatforms();
      this.log.info(`Platform ${platformId} enabled for user ${this.id}`);
    } else {
      throw this.log.error("addPlatform: no such platform", platformId);
    }
    return this.getPlatform(platformId);
  }

  /**
   * Disable a platform on this user
   * @param platformId
   */
  public async removePlatform(platformId: PlatformId): Promise<void> {
    this.log.trace("User", "removePlatforms", platformId);
    if (
      Object.values(PlatformId).includes(platformId) &&
      platformId != PlatformId.UNKNOWN
    ) {
      const platforms = this.data.get("settings", "FEED_PLATFORMS", "");
      const platformIds = platforms ? platforms.split(",") : [];
      const index = platformIds.indexOf(platformId);
      if (index !== -1) {
        platformIds.splice(index, 1);
        this.data.set("settings", "FEED_PLATFORMS", platformIds.join(","));
        await this.data.save();
      }
      this.loadPlatforms();
      this.log.info(`Platform ${platformId} disabled for user ${this.id}`);
    } else {
      throw this.log.error("removePlatform: no such platform", platformId);
    }
  }

  /**
   * @returns all data from the settings store
   
  public getSettings(): { [key: string]: string } {
    return this.data.getStore("settings");
  }
   */

  public async promptCliFields(
    fields: FieldMapping,
  ): Promise<{ [key: string]: string }> {
    const settings = {} as { [key: string]: string };
    const reader = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    for (const key in fields) {
      const current = this.data.get(
        "settings",
        key,
        String(fields[key].default ?? ""),
      );
      const value =
        (await reader.question(`${fields[key].label} ( ${current} ): `)) ||
        current;
      settings[key] = value;
    }
    reader.close();
    return settings;
  }

  /**
   * Update settings with values from payload
   * @param payload - key/value object to save under settings store
   
  public async putSettings(payload: { [key: string]: string }): Promise<void> {
    for (const key in payload) {
      this.data.set("settings", key, payload[key]);
    }
    await this.data.save();
  }
   */
}
