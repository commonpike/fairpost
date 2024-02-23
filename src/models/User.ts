import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as platformClasses from "../platforms";

import Feed from "./Feed";
import Logger from "../services/Logger";
import Platform from "./Platform";

/**
 * User - represents one fairpost user with
 *
 * - getters and setters for key / value pairs, all string.
 *   - uses two 'stores':
 *     - 'settings' is typically what a user maintains,
 *     - 'auth' is what fairpost maintains and may be
 *       stored and encrypted somewhere else
 *   - uses two backends
 *     - 'env' is process.env (.env)
 *     - 'json' is plain json file
 *
 *   - which store uses which backend is set in config
 *
 */

export default class User {
  id: string;
  homedir: string;
  platforms = [] as Platform[];

  jsonData: { [key: string]: string } = {};
  envData: { [key: string]: string } = {};

  constructor(id: string = "default") {
    this.id = id;
    this.loadGlobalEnv();
    this.homedir = this.getEnv("USERS_DIR", "users") + "/" + this.id;
    this.loadUserEnv();
    console.log(this.envData);
    this.loadJson();
  }

  public getFeed() {
    this.loadPlatforms();
    return new Feed(this);
  }

  private loadPlatforms() {
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

  /* storage */

  public get(store: "settings" | "auth", key: string, def?: string): string {
    const storage =
      store === "settings"
        ? this.envData["FAIRPOST_STORAGE_SETTINGS"]
        : (this.envData["FAIRPOST_STORAGE_AUTH"] as "env" | "json");
    switch (storage) {
      case "env":
        return this.getEnv(key, def);
      case "json":
        return this.getJson(key, def);
      default:
        throw Logger.error("Storage " + storage + " not implemented");
    }
  }

  private getEnv(key: string, def?: string): string {
    let value = this.envData["FAIRPOST_" + key] ?? "";
    if (!value) {
      if (def === undefined) {
        throw Logger.error("User.getEnv: Value " + key + " not found.");
      }
      value = def;
    }
    return value;
  }

  private getJson(key: string, def?: string): string {
    let value = this.jsonData[key] ?? "";
    if (!value) {
      if (def === undefined) {
        throw Logger.error("User.getJson: Value " + key + " not found.");
      }
      value = def;
    }
    return value;
  }

  public set(store: "settings" | "auth", key: string, value: string) {
    const storage =
      store === "settings"
        ? this.envData["FAIRPOST_STORAGE_SETTINGS"]
        : (this.envData["FAIRPOST_STORAGE_AUTH"] as "env" | "json");
    switch (storage) {
      case "env":
        return this.setEnv(key, value);
      case "json":
        return this.setJson(key, value);
      default:
        throw Logger.error("User.set: Storage " + storage + " not implemented");
    }
  }

  private setEnv(key: string, value: string) {
    const ui = this.envData["FAIRPOST_UI"];
    if (ui === "cli") {
      console.log("Store this value in your .env file:");
      console.log();
      console.log("FAIRPOST_" + key + "=" + value);
      console.log();
    } else {
      throw Logger.error("User.setEnv: UI " + ui + " not implemented");
    }
  }

  private setJson(key: string, value: string) {
    this.jsonData[key] = value;
    this.saveJson();
  }

  private loadGlobalEnv() {
    // load global env file into user env
    const configPath =
      process.argv
        .find((element) => element.startsWith(`--config=`))
        ?.replace(`--config=`, "") ?? ".env";
    const configPathResolved = path.resolve(__dirname + "/../../" + configPath);

    if (!fs.existsSync(configPathResolved)) {
      throw new Error("Missing global config file: " + configPathResolved);
    }
    dotenv.config({ path: configPathResolved, processEnv: this.envData });

    // allow cli to override FAIRPOST_LOGGER_*
    if (process.argv.includes("--verbose")) {
      this.envData["LOGGER_LEVEL"] = "TRACE";
      this.envData["LOGGER_CONSOLE"] = "true";
    }
  }

  private loadUserEnv() {
    const userEnvFile =
      this.homedir + "/" + this.getEnv("STORAGE_ENVPATH", ".env");
    if (fs.existsSync(userEnvFile)) {
      dotenv.config({
        path: userEnvFile,
        processEnv: this.envData,
        override: true,
      });
    }
  }

  private loadJson() {
    const jsonFile =
      this.homedir +
      "/" +
      this.getEnv("STORAGE_JSONPATH", "var/lib/storage.json");
    if (fs.existsSync(jsonFile)) {
      const jsonData = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
      if (jsonData) {
        this.jsonData = jsonData;
      } else {
        throw new Error("Storage.loadJson: cant parse " + jsonFile);
      }
    }
  }

  private saveJson() {
    const jsonFile =
      this.homedir +
      "/" +
      this.getEnv("STORAGE_JSONPATH", "var/lib/storage.json");
    if (!fs.existsSync(jsonFile)) {
      fs.mkdirSync(path.dirname(jsonFile), { recursive: true });
    }
    fs.writeFileSync(jsonFile, JSON.stringify(this.jsonData, null, "\t"));
  }
}
