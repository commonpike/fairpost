import User from "../User.ts";

import log4js from "log4js";
import log4jsConfig from "../../config/log4js.json" with { type: "json" };

/**
 * UserLog is a wrapper around Log4js, tied to a user;
 * it has exceptional methods for error() and fatal in that
 * they return an Error object.
 */
export default class UserLog {
  private user: User;
  private logger: log4js.Logger | undefined = undefined;

  /**
   * Create a new UserLog.
   * Dont forgt to call await init() afterwards.
   * @param user
   */
  constructor(user: User) {
    this.user = user;
  }

  public async init() {
    await this.getLogger();
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public trace(...args: any[]) {
    this.logger?.trace(this.user.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public debug(...args: any[]) {
    this.logger?.debug(this.user.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public info(...args: any[]) {
    this.logger?.info(this.user.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public warn(...args: any[]) {
    this.logger?.warn(this.user.id, ...args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public error(...args: any[]): Error {
    this.logger?.error(this.user.id, ...args);
    return new Error(
      "Error: " +
        "(" +
        this.user.id +
        ") " +
        args.filter((arg) => typeof arg === "string").join("; "),
    );
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  public fatal(...args: any[]): Error {
    this.logger?.fatal(this.user.id, ...args);
    const code = parseInt(args[0]);
    process.exitCode = code || 1;
    return new Error(
      "Fatal: " +
        +"(" +
        this.user.id +
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
    const configFile = this.user.data.get("settings", "LOGGER_CONFIG");
    if (process.argv.includes("--verbose")) {
      process.env.FAIRPOST_LOGGER_LEVEL = "TRACE";
      process.env.FAIRPOST_LOGGER_CONSOLE = "true";
    }
    const level = this.user.data!.get("settings", "LOGGER_LEVEL", "INFO");
    const addConsole =
      this.user.data!.get("settings", "LOGGER_CONSOLE", "false") === "true";

    const config = (await this.user.files.isFile(configFile))
      ? JSON.parse(await this.user.files.readFile(configFile))
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
    logger.addContext("userId", this.user.id);
    logger.level = level;
    return logger;
  }
}
