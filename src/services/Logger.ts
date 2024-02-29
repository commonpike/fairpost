/**
 * Logger - minimalist singleton service
 *
 * - wraps log4js
 * - allows overrides from env
 * - returns Errors on error() and fatal()
 * - sets exitCode on fatal()
 *
 */

import * as log4js from "log4js";

class Logger {
  static instance: Logger;
  logger: log4js.Logger;
  constructor() {
    if (Logger.instance) {
      throw new Error("Logger: call getInstance() instead");
    }
    const configFile = process.env.FAIRPOST_LOGGER_CONFIG || "log4js.json";
    const category = process.env.FAIRPOST_LOGGER_CATEGORY || "default";
    //const level = process.env.FAIRPOST_LOGGER_LEVEL || "INFO";
    //const console = process.env.FAIRPOST_LOGGER_CONSOLE !== "false";
    const level = "TRACE";
    const console = true;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require(__dirname + "/../../" + configFile);
    if (!config.categories[category]) {
      throw new Error(
        "Logger: Log4js category " + category + " not found in " + configFile,
      );
    }
    if (
      console &&
      !config.categories[category]["appenders"].includes("console")
    ) {
      if (!config.appenders["console"]) {
        config.appenders["console"] = { type: "console" };
      }
      config.categories[category]["appenders"].push("console");
    }

    log4js.configure(config);
    this.logger = log4js.getLogger(category);
    this.logger.level = level;
  }
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  trace(...args: any[]) {
    this.logger.trace(args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  debug(...args: any[]) {
    this.logger.debug(args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  info(...args: any[]) {
    this.logger.info(args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  warn(...args: any[]) {
    this.logger.warn(args);
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  error(...args: any[]): Error {
    this.logger.error(args);
    return new Error(
      "Error: " + args.filter((arg) => typeof arg === "string").join("; "),
    );
  }
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  fatal(...args: any[]): Error {
    this.logger.fatal(args);
    const code = parseInt(args[0]);
    process.exitCode = code || 1;
    return new Error(
      "Fatal: " + args.filter((arg) => typeof arg === "string").join("; "),
    );
  }
}
export default Logger.getInstance();
