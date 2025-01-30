import * as fs from "fs";
import * as log4js from "log4js";
import * as path from "path";
import * as platformClasses from "../platforms";

import Feed from "./Feed";
import Platform from "./Platform";
import Store from "./Store";

import { PlatformId } from "../platforms";
import UserMapper from "../mappers/UserMapper";

/**
 * User - represents one fairpost user with a feed.
 *
 * Contains getters and setters for key / value pairs,
 * using a store. Contains a mapper to create a dto;
 * and a private logger for this account, seperate from
 * the Fairpost logger.
 *
 */

export default class User {
  id: string;
  homedir: string;
  platforms = [] as Platform[];
  mapper: UserMapper;
  store: Store;
  logger: log4js.Logger;

  jsonData: { [key: string]: string } = {};
  envData: { [key: string]: string } = {};

  constructor(id: string) {
    this.id = id;
    this.store = new Store(this.id);
    this.homedir = this.get("settings", "USER_HOMEDIR", "users/%user%").replace(
      "%user%",
      this.id,
    );
    if (
      !fs.existsSync(this.homedir) ||
      !fs.statSync(this.homedir).isDirectory()
    ) {
      throw new Error("No such user: " + id);
    }
    this.mapper = new UserMapper(this);
    this.logger = this.getLogger();
  }

  /**
   * @returns the new user
   */

  public static createUser(newUserId: string): User {
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
    if (fs.existsSync(dst)) {
      throw new Error("Homedir already exists: " + dst);
    }
    fs.cpSync(src, dst, { recursive: true });

    const user = new User(newUserId);
    user.set("settings", "FEED_PLATFORMS", "");
    user.info("User created: " + newUserId);
    return user;
  }

  /**
   * @returns the feed for this user
   */

  public getFeed(): Feed {
    this.loadPlatforms();
    return new Feed(this);
  }

  /**
   * Load all available platforms, and set
   * those that are active in the settings,
   * active
   */
  private loadPlatforms(): void {
    const platformIds = this.get("settings", "FEED_PLATFORMS", "").split(",");
    Object.values(platformClasses).forEach((platformClass) => {
      if (typeof platformClass === "function") {
        if (platformIds.includes(platformClass.id())) {
          const platform = new platformClass(this);
          platform.active = true;
          this.platforms.push(platform);
        }
      }
    });
  }

  /**
   * Enable a platform on this user
   * @param platformId
   */
  public addPlatform(platformId: PlatformId): void {
    if (
      Object.values(PlatformId).includes(platformId) &&
      platformId != PlatformId.UNKNOWN
    ) {
      const platformIds = this.get("settings", "FEED_PLATFORMS", "").split(",");
      if (!platformIds.includes(platformId)) {
        platformIds.push(platformId);
        this.set("settings", "FEED_PLATFORMS", platformIds.join(","));
      }
      this.platforms = [];
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
      this.platforms = [];
      this.loadPlatforms();
      this.info(`Platform ${platformId} disabled for user ${this.id}`);
    } else {
      throw this.error("removePlatform: no such platform", platformId);
    }
  }

  public get(
    store: "settings" | "auth" | "app",
    key: string,
    def?: string,
  ): string {
    try {
      return this.store.get(store, key, def);
    } catch (error) {
      throw this.error(error);
    }
  }

  public set(store: "settings" | "auth" | "app", key: string, value: string) {
    try {
      return this.store.set(store, key, value);
    } catch (error) {
      throw this.error(error);
    }
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public trace(...args: any[]) {
    this.logger.trace(this.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public debug(...args: any[]) {
    this.logger.debug(this.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public info(...args: any[]) {
    this.logger.info(this.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public warn(...args: any[]) {
    this.logger.warn(this.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public error(...args: any[]): Error {
    this.logger.error(this.id, ...args);
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
    this.logger.fatal(this.id, ...args);
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
  private getLogger(): log4js.Logger {
    const configFile = this.store.get(
      "settings",
      "LOGGER_CONFIG",
      "log4js.json",
    );
    const level = this.store.get("settings", "LOGGER_LEVEL", "INFO");
    const addConsole =
      this.store.get("settings", "LOGGER_CONSOLE", "false") === "true";

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = fs.existsSync(this.homedir + "/" + configFile)
      ? JSON.parse(
          fs.readFileSync(
            path.resolve(
              __dirname + "/../../",
              this.homedir + "/" + configFile,
            ),
            "utf8",
          ),
        )
      : JSON.parse(
          fs.readFileSync(
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
