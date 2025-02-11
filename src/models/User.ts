import { promises as fs } from "fs";
import * as log4js from "log4js";
import * as path from "path";
import * as platformClasses from "../platforms";

import Feed from "./Feed";
import Platform from "./Platform";
import Store from "./Store";

import { PlatformId } from "../platforms";
import UserMapper from "../mappers/UserMapper";

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
  id: string;
  homedir: string = "";
  feed: Feed | undefined;
  platforms:
    | {
        [id in PlatformId]?: Platform;
      }
    | undefined = undefined;
  mapper: UserMapper;
  store: Store | undefined;
  logger: log4js.Logger | undefined = undefined;

  jsonData: { [key: string]: string } = {};
  envData: { [key: string]: string } = {};

  /**
   * Dont call the constructor yourself;
   * instead, call `await User.getUser()`
   * @param id
   */
  constructor(id: string) {
    this.id = id;
    this.mapper = new UserMapper(this);
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
    user.store = await Store.getStore(id);
    user.homedir = user
      .get("settings", "USER_HOMEDIR", "users/%user%")
      .replace("%user%", id);
    try {
      const stat = await fs.stat(user.homedir);
      if (!stat.isDirectory()) {
        throw new Error();
      }
    } catch {
      throw new Error("No such user: " + id);
    }
    user.logger = await user.getLogger();
    return user;
  }

  // tmp
  public static async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
    } catch {
      return false;
    }
    return true;
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
    const src = path.resolve(__dirname, "../../etc/skeleton");
    if (!process.env.FAIRPOST_USER_HOMEDIR) {
      throw new Error("FAIRPOST_USER_HOMEDIR not set in env");
    }
    const dst = process.env.FAIRPOST_USER_HOMEDIR.replace("%user%", newUserId);
    if (await User.fileExists(dst)) {
      throw new Error("Homedir already exists: " + dst);
    }
    await fs.cp(src, dst, { recursive: true });

    const user = new User(newUserId);
    user.set("settings", "FEED_PLATFORMS", "");
    await user.save();
    user.info("User created: " + newUserId);
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
    this.trace("User", "loadPlatforms");
    const platformIds = this.get("settings", "FEED_PLATFORMS", "").split(",");
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
    this.trace("User", "getPlatform", platformId);
    if (this.platforms === undefined) {
      this.loadPlatforms();
    }
    const platform = this.platforms?.[platformId];
    if (!platform) {
      throw this.error("Unknown or disabled platform: " + platformId);
    }
    return platform;
  }

  /**
   * Get multiple platforms
   * @param platformIds - the slug of the platform
   * @returns platforms given by ids
   */
  getPlatforms(platformIds?: PlatformId[]): Platform[] {
    this.trace("User", "getPlatforms", platformIds);
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
    this.trace("User", "addPlatform", platformId);
    if (
      Object.values(PlatformId).includes(platformId) &&
      platformId != PlatformId.UNKNOWN
    ) {
      const platformIds = this.get("settings", "FEED_PLATFORMS", "").split(",");
      if (!platformIds.includes(platformId)) {
        platformIds.push(platformId);
        this.set("settings", "FEED_PLATFORMS", platformIds.join(","));
      }
      this.loadPlatforms();
      this.info(`Platform ${platformId} enabled for user ${this.id}`);
    } else {
      throw this.error("addPlatform: no such platform", platformId);
    }
  }

  /**
   * Disable a platform on this user
   * @param platformId
   */
  public removePlatform(platformId: PlatformId): void {
    this.trace("User", "removePlatforms", platformId);
    if (
      Object.values(PlatformId).includes(platformId) &&
      platformId != PlatformId.UNKNOWN
    ) {
      const platformIds = this.get("settings", "FEED_PLATFORMS", "").split(",");
      const index = platformIds.indexOf(platformId);
      if (index !== -1) {
        platformIds.splice(index, 1);
        this.set("settings", "FEED_PLATFORMS", platformIds.join(","));
      }
      this.loadPlatforms();
      this.info(`Platform ${platformId} disabled for user ${this.id}`);
    } else {
      throw this.error("removePlatform: no such platform", platformId);
    }
  }

  /*
    User Store 
  */

  public get(
    store: "settings" | "auth" | "app",
    key: string,
    def?: string,
  ): string {
    if (!this.store) {
      throw new Error("User.get: No store");
    }
    try {
      return this.store.get(store, key, def);
    } catch (error) {
      throw this.error(error);
    }
  }

  public set(store: "settings" | "auth" | "app", key: string, value: string) {
    if (!this.store) {
      throw new Error("User.set: No store");
    }
    try {
      return this.store.set(store, key, value);
    } catch (error) {
      throw this.error(error);
    }
  }

  public async save() {
    if (!this.store) {
      throw new Error("User.save: No store");
    }
    try {
      return await this.store.save();
    } catch (error) {
      throw this.error(error);
    }
  }

  /*
    User logging 
  */

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public trace(...args: any[]) {
    this.logger?.trace(this.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public debug(...args: any[]) {
    this.logger?.debug(this.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public info(...args: any[]) {
    this.logger?.info(this.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public warn(...args: any[]) {
    this.logger?.warn(this.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public error(...args: any[]): Error {
    this.logger?.error(this.id, ...args);
    return new Error(
      "Error: " +
        "(" +
        this.id +
        ") " +
        args.filter((arg) => typeof arg === "string").join("; "),
    );
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public fatal(...args: any[]): Error {
    this.logger?.fatal(this.id, ...args);
    const code = parseInt(args[0]);
    process.exitCode = code || 1;
    return new Error(
      "Fatal: " +
        +"(" +
        this.id +
        ") " +
        args.filter((arg) => typeof arg === "string").join("; "),
    );
  }

  /**
   * @returns a logger to use on this user
   *
   * allow cli/env to override level and console
   */
  private async getLogger(): Promise<log4js.Logger> {
    if (!this.store) {
      throw new Error("User.getLogger: No store");
    }
    const configFile = this.store.get(
      "settings",
      "LOGGER_CONFIG",
      "log4js.json",
    );
    if (process.argv.includes("--verbose")) {
      process.env.FAIRPOST_LOGGER_LEVEL = "TRACE";
      process.env.FAIRPOST_LOGGER_CONSOLE = "true";
    }
    const level = this.store.get("settings", "LOGGER_LEVEL", "INFO");
    const addConsole =
      this.store!.get("settings", "LOGGER_CONSOLE", "false") === "true";

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = (await User.fileExists(this.homedir + "/" + configFile))
      ? JSON.parse(
          await fs.readFile(
            path.resolve(
              __dirname + "/../../",
              this.homedir + "/" + configFile,
            ),
            "utf8",
          ),
        )
      : JSON.parse(
          await fs.readFile(
            path.resolve(__dirname + "/../../", configFile),
            "utf8",
          ),
        );
    if (!config.categories["user"]) {
      throw new Error(
        "Logger: Log4js category user not found in " + configFile,
      );
    }

    if (
      addConsole &&
      !config.categories["user"]["appenders"].includes("console")
    ) {
      if (!config.appenders["console"]) {
        config.appenders["console"] = { type: "console" };
      }
      config.categories["user"]["appenders"].push("console");
    }

    log4js.configure(config);
    const logger = log4js.getLogger("user");
    logger.addContext("userId", this.id);
    logger.level = level;
    return logger;
  }
}
