import * as fs from "fs";
import * as log4js from "log4js";
import * as path from "path";
import * as platformClasses from "../platforms";

import Feed from "./Feed";
import Platform from "./Platform";
import Store from "./Store";

/**
 * User - represents one fairpost user with
 *
 * - getters and setters for key / value pairs, all string.
 *
 */

export default class User {
  id: string;
  homedir: string;
  platforms = [] as Platform[];
  store: Store;
  logger: log4js.Logger;

  jsonData: { [key: string]: string } = {};
  envData: { [key: string]: string } = {};

  constructor(id: string = "default") {
    this.id = id;
    this.store = new Store(this.id);
    this.homedir = this.get("settings", "USER_HOMEDIR", "users/%user%").replace(
      "%user%",
      this.id,
    );
    this.logger = this.getLogger();
    if (
      !fs.existsSync(this.homedir) ||
      !fs.statSync(this.homedir).isDirectory()
    ) {
      throw this.error("No such user: " + id);
    }
  }

  /**
   * Return a small report for this feed
   * @returns the report in text
   */

  report(): string {
    this.trace("User", "report");
    let report = "";
    report += "\nUser: " + this.id;
    report += "\n - homedir: " + this.homedir;
    return report;
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
    const activePlatformIds = this.get("settings", "FEED_PLATFORMS", "").split(
      ",",
    );

    Object.values(platformClasses).forEach((platformClass) => {
      if (typeof platformClass === "function") {
        const platform = new platformClass(this);
        platform.active = activePlatformIds.includes(platform.id);
        this.platforms.push(platform);
      }
    });
  }

  public get(store: "settings" | "auth", key: string, def?: string): string {
    try {
      return this.store.get(store, key, def);
    } catch (error) {
      throw this.error(error);
    }
  }

  public set(store: "settings" | "auth", key: string, value: string) {
    try {
      return this.store.set(store, key, value);
    } catch (error) {
      throw this.error(error);
    }
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public trace(...args: any[]) {
    this.logger.trace(args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public debug(...args: any[]) {
    this.logger.debug(args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public info(...args: any[]) {
    this.logger.info(args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public warn(...args: any[]) {
    this.logger.warn(args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public error(...args: any[]): Error {
    this.logger.error(args);
    return new Error(
      "Error: " + args.filter((arg) => typeof arg === "string").join("; "),
    );
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public fatal(...args: any[]): Error {
    this.logger.fatal(args);
    const code = parseInt(args[0]);
    process.exitCode = code || 1;
    return new Error(
      "Fatal: " + args.filter((arg) => typeof arg === "string").join("; "),
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
    const category = this.store.get("settings", "LOGGER_CATEGORY", "default");
    const level = this.store.get("settings", "LOGGER_LEVEL", "INFO");
    const addConsole =
      this.store.get("settings", "LOGGER_CONSOLE", "false") === "true";

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = fs.existsSync(this.homedir + "/" + configFile)
      ? require(
          path.resolve(__dirname + "/../../", this.homedir + "/" + configFile),
        )
      : require(path.resolve(__dirname + "/../../", configFile));
    if (!config.categories[category]) {
      throw new Error(
        "Logger: Log4js category " + category + " not found in " + configFile,
      );
    }
    for (const appender in config.appenders) {
      if (config.appenders[appender].filename) {
        config.appenders[appender].filename = config.appenders[
          appender
        ].filename?.replace("%user%", this.id);
      }
    }

    if (
      addConsole &&
      !config.categories[category]["appenders"].includes("console")
    ) {
      if (!config.appenders["console"]) {
        config.appenders["console"] = { type: "console" };
      }
      config.categories[category]["appenders"].push("console");
    }

    log4js.configure(config);
    const logger = log4js.getLogger(category);
    logger.level = level;
    return logger;
  }
}
