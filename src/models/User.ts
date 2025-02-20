import { resolve } from "path";

import log4js from "log4js";
import log4jsConfig from "../config/log4js.json" with { type: "json" };

import { FileStorage } from "@flystorage/file-storage";
import { LocalStorageAdapter } from "@flystorage/local-fs";

import * as platformClasses from "../platforms/index.ts";
import { PlatformId } from "../platforms/index.ts";

import Feed from "./Feed.ts";
import Platform from "./Platform.ts";
import Store from "./Store.ts";

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

  private data: Store | undefined;
  private logger: log4js.Logger | undefined = undefined;
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
    user.data = await Store.getStore(id);
    user.logger = await user.getLogger();
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
    user.set("settings", "FEED_PLATFORMS", "");
    await user.save();
    for (const msg of log) {
      user.info(msg);
    }
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
    if (!this.data) {
      throw new Error("User.get: No store");
    }
    try {
      return this.data.get(store, key, def);
    } catch (error) {
      throw this.error(error);
    }
  }

  public set(store: "settings" | "auth" | "app", key: string, value: string) {
    if (!this.data) {
      throw new Error("User.set: No store");
    }
    try {
      return this.data.set(store, key, value);
    } catch (error) {
      throw this.error(error);
    }
  }

  public async save() {
    if (!this.data) {
      throw new Error("User.save: No store");
    }
    try {
      return await this.data.save();
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
    if (!this.data) {
      throw new Error("User.getLogger: No store");
    }
    const configFile = this.data.get(
      "settings",
      "LOGGER_CONFIG",
      "log4js.json",
    );
    if (process.argv.includes("--verbose")) {
      process.env.FAIRPOST_LOGGER_LEVEL = "TRACE";
      process.env.FAIRPOST_LOGGER_CONSOLE = "true";
    }
    const level = this.data!.get("settings", "LOGGER_LEVEL", "INFO");
    const addConsole =
      this.data!.get("settings", "LOGGER_CONSOLE", "false") === "true";

    const config = (await this.files.fileExists(configFile))
      ? JSON.parse(await this.files.readToString(configFile))
      : log4jsConfig;
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
