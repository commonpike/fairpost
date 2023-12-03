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
    const level = process.env.FAIRPOST_LOGGER_LEVEL || "INFO";
    const console = process.env.FAIRPOST_LOGGER_CONSOLE !== "false";

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
  trace(...args) {
    this.logger.trace(args);
  }
  debug(...args) {
    this.logger.trace(args);
  }
  info(...args) {
    this.logger.trace(args);
  }
  warn(...args) {
    this.logger.trace(args);
  }
  error(...args) {
    this.logger.trace(args);
  }
  fatal(...args) {
    this.logger.trace(args);
  }
}
export default Logger.getInstance();
