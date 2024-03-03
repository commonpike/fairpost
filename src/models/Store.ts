import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

/**
 * Store
 *
 * - sets and gets key / value pairs, all string.
 * - uses two 'stores':
 *   - 'settings' is typically what a user maintains,
 *   - 'auth' is what fairpost maintains and may be
 *     stored and encrypted somewhere else
 * - uses two backends
 *   - 'env' is process.env (.env)
 *   - 'json' is plain json file
 *
 * which store uses which backend should be
 * set in the environment
 */

export default class Store {
  jsonPath: string;
  jsonData: { [key: string]: string } = {};
  envPath: string;
  envData: { [key: string]: string } = {};
  constructor(userid: string) {
    this.loadGlobalEnv();
    this.envPath = this.getEnv("USER_ENVPATH", "users/%user%/.env").replace(
      "%user%",
      userid,
    );
    this.loadUserEnv();
    this.jsonPath = this.getEnv(
      "USER_JSONPATH",
      "users/%user%/var/lib/storage.json",
    ).replace("%user%", userid);
    this.loadJson();
  }

  public get(store: "settings" | "auth", key: string, def?: string): string {
    const storage =
      store === "settings"
        ? this.envData["FAIRPOST_STORAGE_SETTINGS"]
        : this.envData["FAIRPOST_STORAGE_AUTH"];
    switch (storage) {
      case "env":
        return this.getEnv(key, def);
      case "json":
        return this.getJson(key, def);
      default:
        throw new Error("Storage " + storage + " not implemented");
    }
  }

  private getEnv(key: string, def?: string): string {
    let value = this.envData["FAIRPOST_" + key] ?? "";
    if (!value) {
      if (def === undefined) {
        throw new Error("Storage.getEnv: Value " + key + " not found.");
      }
      value = def;
    }
    return value;
  }

  private getJson(key: string, def?: string): string {
    let value = this.jsonData[key] ?? "";
    if (!value) {
      if (def === undefined) {
        throw new Error("Storage.getJson: Value " + key + " not found.");
      }
      value = def;
    }
    return value;
  }

  public set(store: "settings" | "auth", key: string, value: string) {
    const storage =
      store === "settings"
        ? this.envData["FAIRPOST_STORAGE_SETTINGS"]
        : this.envData["FAIRPOST_STORAGE_AUTH"];
    switch (storage) {
      case "env":
        return this.setEnv(key, value);
      case "json":
        return this.setJson(key, value);
      default:
        throw new Error("Storage " + storage + " not implemented");
    }
  }

  private setEnv(key: string, value: string) {
    const ui = this.envData["FAIRPOST_UI"];
    if (ui === "cli") {
      console.log("Store this value in your users .env file:");
      console.log();
      console.log("FAIRPOST_" + key + "=" + value);
      console.log();
    } else {
      throw new Error("Storage.setEnv: UI " + ui + " not supported");
    }
  }

  private setJson(key: string, value: string) {
    this.jsonData[key] = value;
    this.saveJson();
  }

  private loadJson() {
    if (fs.existsSync(this.jsonPath)) {
      const jsonData = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      if (jsonData) {
        this.jsonData = jsonData;
      } else {
        throw new Error("Storage.loadJson: cant parse " + this.jsonPath);
      }
    }
  }

  private saveJson() {
    if (!fs.existsSync(this.jsonPath)) {
      fs.mkdirSync(path.dirname(this.jsonPath), { recursive: true });
    }
    fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, "\t"));
  }

  /**
   * Load the global, non-user, env
   * into the user store. You can override
   * the path on the cli using --config=[path]
   */
  private loadGlobalEnv() {
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

  /**
   * Load the personal user env
   * into the user store, optionally overriding
   * global settings. It is located in the users
   * homedir at USER_ENVPATH
   */
  private loadUserEnv() {
    if (fs.existsSync(this.envPath)) {
      dotenv.config({
        path: this.envPath,
        processEnv: this.envData,
        override: true,
      });
    }
  }
}
