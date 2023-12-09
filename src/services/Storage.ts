import Logger from "./Logger";

/**
 * Storage - minimalist singleton service
 *
 * - sets and gets key / value pairs.
 * - uses two 'stores':
 *   - 'settings' is typically what a user maintains,
 *   - 'auth' is what fairpost maintains and may be
 *     stored and encrypted somewhere else
 *
 */

class Storage {
  static instance: Storage;

  constructor() {
    if (Storage.instance) {
      throw new Error("Storage: call getInstance() instead");
    }
  }

  static getInstance(): Storage {
    if (!Storage.instance) {
      Storage.instance = new Storage();
    }
    return Storage.instance;
  }

  public get(store: "settings" | "auth", key: string, def?: string): string {
    let value = "" as string;
    const storage =
      store === "settings"
        ? process.env.FAIRPOST_STORAGE_SETTINGS
        : process.env.FAIRPOST_STORAGE_AUTH;
    if (storage === "env") {
      value = process.env["FAIRPOST_" + key] ?? "";
    } else {
      throw Logger.error("Storage " + storage + " not implemented");
    }
    if (!value) {
      if (def === undefined) {
        throw Logger.error("Value " + key + " not found in store " + store);
      }
      value = def;
    }
    return value;
  }

  public set(store: "settings" | "auth", key: string, value: string) {
    const storage =
      store === "settings"
        ? process.env.FAIRPOST_STORAGE_SETTINGS
        : process.env.FAIRPOST_STORAGE_AUTH;
    const ui = process.env.FAIRPOST_UI;
    if (storage === "env") {
      if (ui === "cli") {
        console.log("Store this value in your .env file:");
        console.log();
        console.log("FAIRPOST_" + key + "=" + value);
        console.log();
      } else {
        throw Logger.error("UI " + ui + " not implemented");
      }
    } else {
      throw Logger.error("Storage " + storage + " not implemented");
    }
  }
}

export default Storage.getInstance();
