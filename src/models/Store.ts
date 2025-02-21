import { dirname } from "path";
import User from "./User.ts";

/**
 * Store
 *
 * - sets and gets key / value pairs, all string.
 * - uses three 'stores':
 *   - 'app' is typically what the admin maintains
 *   - 'settings' is typically what a user maintains,
 *   - 'auth' is what fairpost maintains and may be
 *     stored and encrypted somewhere else
 * - it store has a backend, one of
 *   - 'env' is process.env (.env)
 *   - 'json' is json file, with one key for each store and a flat list below it
 *   - 'json-env' is the above json file with .env as fallback
 *
 * which store uses which backend should be
 * set in the environment
 */

type StorageType = "app" | "settings" | "auth";
enum StorageKeys {
  "app" = "FAIRPOST_STORAGE_APP",
  "settings" = "FAIRPOST_STORAGE_SETTINGS",
  "auth" = "FAIRPOST_STORAGE_AUTH",
}

export default class Store {
  jsonPath: string;
  jsonData: { [store: string]: { [key: string]: string } } = {};
  user: User;
  /**
   * Dont call the constructor yourself;
   * instead, call `await Store.getStore()`
   * @param user
   */
  constructor(user: User) {
    this.user = user;
    this.jsonPath = this.getEnv("app", "USER_JSONPATH", "storage.json").replace(
      "%user%",
      user.id,
    );
  }

  /**
   * getStore
   *
   * get a new store and do some async checks and loads.
   * @param user
   * @returns new store object
   */
  public static async getStore(user: User): Promise<Store> {
    const store = new Store(user);
    await store.load();
    return store;
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
        throw new Error("Storage " + storage + " not implemented");
    }
  }

  private getEnv(store: StorageType, key: string, def?: string): string {
    let value = process.env["FAIRPOST_" + key] ?? "";
    if (!value) {
      if (def === undefined) {
        throw new Error(
          "Storage.getEnv: Value " + "FAIRPOST_" + key + " not found.",
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
          "Storage.getJson: Value " + store + "." + key + " not found.",
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
        throw new Error("Storage " + storage + " not implemented");
    }
  }

  private setEnv(store: StorageType, key: string, value: string) {
    const ui = process.env.FAIRPOST_UI ?? "none";
    if (ui === "cli") {
      console.log("Store this value in your users .env file:");
      console.log();
      console.log("FAIRPOST_" + key + "=" + value);
      console.log();
    } else {
      throw new Error("Storage.setEnv: UI " + ui + " not supported");
    }
  }

  private setJson(store: StorageType, key: string, value: string) {
    if (!(store in this.jsonData)) {
      this.jsonData[store] = {};
    }
    this.jsonData[store][key] = value;
    // dont forget to call save()
  }

  private async loadJson() {
    if (await this.user.files.fileExists(this.jsonPath)) {
      const contents = await this.user.files.readToString(this.jsonPath);
      const jsonData = JSON.parse(contents);
      if (jsonData) {
        this.jsonData = jsonData;
      } else {
        throw new Error("Store.loadJson: cant parse " + this.jsonPath);
      }
    } else {
      throw new Error("Store.loadJson: cant read " + this.jsonPath);
    }
  }

  private async saveJson() {
    if (!(await this.user.files.fileExists(this.jsonPath))) {
      await this.user.files.createDirectory(dirname(this.jsonPath));
    }
    try {
      const contents = JSON.stringify(this.jsonData, null, "\t");
      await this.user.files.write(this.jsonPath, contents);
    } catch {
      throw new Error("Store.saveJson: cant write " + this.jsonPath);
    }
  }
}
