import { dirname } from "path";
import User from "../User.ts";

/**
 * UserData
 *
 * - sets and gets key / value pairs, all string.
 * - uses four 'stores':
 *   - 'app' is typically what the admin maintains
 *   - 'settings' is typically what a user maintains,
 *   - 'auth' is what fairpost maintains and may be
 *     stored and encrypted somewhere else
 *  - 'cache' is what fairpost maintains and may be
 *     deleted at any time
 * - each store has a backend, one of
 *   - 'env' is process.env (.env)
 *   - 'json' is json file, with one key for each store and a flat list below it
 *   - 'json-env' is the above json file with .env as fallback
 *
 * which store uses which backend should be
 * set in the environment
 */

type StorageType = "app" | "settings" | "auth" | "cache";
enum StorageKeys {
  "app" = "FAIRPOST_STORAGE_APP",
  "settings" = "FAIRPOST_STORAGE_SETTINGS",
  "auth" = "FAIRPOST_STORAGE_AUTH",
  "cache" = "FAIRPOST_STORAGE_CACHE",
}

export default class UserData {
  jsonPath: string;
  jsonData: { [store: string]: { [key: string]: string } } = {};
  user: User;
  /**
   * Create a new UserData.
   * Dont forgt to call await init() afterwards.
   * @param user
   */
  constructor(user: User) {
    this.user = user;
    this.jsonPath = this.getEnv("app", "USER_JSONPATH", "storage.json").replace(
      "%user%",
      user.id,
    );
  }

  public async init() {
    await this.load();
  }

  public async load() {
    await this.loadJson();
  }

  public async save() {
    await this.saveJson();
  }

  public get(store: StorageType, key: string, def?: string): string {
    const storageKey = StorageKeys[store];
    const storage = process.env[storageKey] ?? "none";
    switch (storage) {
      case "env":
        return this.getEnv(store, key, def);
      case "json-env":
        try {
          return this.getJson(store, key);
        } catch {
          return this.getEnv(store, key, def);
        }
      case "json":
        return this.getJson(store, key, def);
      default:
        throw new Error("UserData: Storage " + storage + " not implemented");
    }
  }

  public getObject(store: StorageType, key: string, def?: object): object {
    const value = this.get(store, key, JSON.stringify(def));
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(
        "UserData.getObject: Value " + store + "." + key + " not a valid json",
      );
    }
  }

  private getEnv(store: StorageType, key: string, def?: string): string {
    let value = process.env["FAIRPOST_" + key] ?? "";
    if (!value) {
      if (def === undefined) {
        throw new Error(
          "UserData.getEnv: Value " + "FAIRPOST_" + key + " not found.",
        );
      }
      value = def;
    }
    return value;
  }

  private getJson(store: StorageType, key: string, def?: string): string {
    let value = this.jsonData[store]?.[key] ?? "";
    if (!value) {
      if (def === undefined) {
        throw new Error(
          "UserData.getJson: Value " + store + "." + key + " not found.",
        );
      }
      value = def;
    }
    return value;
  }

  public set(store: StorageType, key: string, value: string) {
    const storageKey = StorageKeys[store];
    const storage = process.env[storageKey] ?? "none";
    switch (storage) {
      case "env":
        return this.setEnv(store, key, value);
      case "json-env":
      case "json":
        return this.setJson(store, key, value);
      default:
        throw new Error("UserData: Storage " + storage + " not implemented");
    }
  }

  public setObject(store: StorageType, key: string, value: object) {
    return this.set(store, key, JSON.stringify(value));
  }

  private setEnv(store: StorageType, key: string, value: string) {
    const ui = process.env.FAIRPOST_UI ?? "none";
    if (ui === "cli") {
      console.log("Store this value in your users .env file:");
      console.log();
      console.log("FAIRPOST_" + key + "=" + value);
      console.log();
    } else {
      throw new Error("UserData.setEnv: UI " + ui + " not supported");
    }
  }

  private setJson(store: StorageType, key: string, value: string) {
    if (!(store in this.jsonData)) {
      this.jsonData[store] = {};
    }
    this.jsonData[store][key] = value;
    // dont forget to call save()
  }

  public del(store: StorageType, key: string) {
    const storageKey = StorageKeys[store];
    const storage = process.env[storageKey] ?? "none";
    switch (storage) {
      case "env":
        return this.delEnv(store, key);
      case "json-env":
      case "json":
        return this.delJson(store, key);
      default:
        throw new Error("UserData: Storage " + storage + " not implemented");
    }
  }

  private delEnv(store: StorageType, key: string) {
    const ui = process.env.FAIRPOST_UI ?? "none";
    if (ui === "cli") {
      console.log("Remove this value from your users .env file:");
      console.log();
      console.log("FAIRPOST_" + key);
      console.log();
    } else {
      throw new Error("UserData.setEnv: UI " + ui + " not supported");
    }
  }

  private delJson(store: StorageType, key: string) {
    if (!(store in this.jsonData)) {
      this.jsonData[store] = {};
    }
    if (key in this.jsonData[store]) {
      delete this.jsonData[store][key];
    }
    // dont forget to call save()
  }

  private async loadJson() {
    if (await this.user.files.isFile(this.jsonPath)) {
      const contents = await this.user.files.readFile(this.jsonPath);
      const jsonData = JSON.parse(contents);
      if (jsonData) {
        this.jsonData = jsonData;
      } else {
        throw new Error("UserData.loadJson: cant parse " + this.jsonPath);
      }
    } else {
      throw new Error("UserData.loadJson: cant read " + this.jsonPath);
    }
  }

  private async saveJson() {
    if (!(await this.user.files.exists(this.jsonPath))) {
      await this.user.files.mkdir(dirname(this.jsonPath));
    }
    try {
      const contents = JSON.stringify(this.jsonData, null, "\t");
      await this.user.files.write(this.jsonPath, contents);
    } catch {
      throw new Error("UserData.saveJson: cant write " + this.jsonPath);
    }
  }
}
