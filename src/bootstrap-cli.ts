import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// allow cli to switch .env file
const configPath =
  process.argv
    .find((element) => element.startsWith(`--config=`))
    ?.replace(`--config=`, "") ?? ".env";
const configPathResolved = path.resolve(__dirname + "/../" + configPath);

if (!fs.existsSync(configPathResolved)) {
  throw new Error("Missing config file: " + configPathResolved);
}
dotenv.config({ path: configPathResolved });

// allow cli to override FAIRPOST_LOGGER_*
if (process.argv.includes("--verbose")) {
  process.env.FAIRPOST_LOGGER_LEVEL = "TRACE";
  process.env.FAIRPOST_LOGGER_CONSOLE = "true";
}
