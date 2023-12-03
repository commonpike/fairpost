import * as log4js from "log4js";

const configFile = process.env.FAIRPOST_LOGGER_CONFIG || "log4js.json";
const category = process.env.FAIRPOST_LOGGER_CATEGORY || "default";
const level = process.env.FAIRPOST_LOGGER_LEVEL || "INFO";
const console = process.env.FAIRPOST_LOGGER_CONSOLE !== "false";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require(__dirname + "/../../" + configFile);
if (!config.categories[category]) {
  throw new Error(
    "Log4js category " + category + " not found in " + configFile,
  );
}
if (console && !config.categories[category]["appenders"].includes("console")) {
  if (!config.appenders["console"]) {
    config.appenders["console"] = { type: "console" };
  }
  config.categories[category]["appenders"].push("console");
}

log4js.configure(config);
const logger = log4js.getLogger(category);
logger.level = level;

export default logger;

// (trace, debug, info, warn, error, fatal).
/*export default class Logger {
    trace(msg) {
        logger.trace(msg);
    }
    debug(msg) {
        logger.trace(msg);
    }
    info(msg) {
        logger.trace(msg);
    }
    warn(msg) {
        logger.trace(msg);
    }
    error(msg) {
        logger.trace(msg);
    }
    fatal(msg) {
        logger.trace(msg);
    }
}
*/
