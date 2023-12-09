import * as fs from "fs";
import * as path from "path";

import Logger from "./Logger";

/**
 * Storage - minimalist singleton service
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

class Storage {
  static instance: Storage;
  jsonData: { [key: string]: string } = {};

  constructor() {
    if (Storage.instance) {
      throw new Error("Storage: call getInstance() instead");
    }
    this.loadJson();
  }

  static getInstance(): Storage {
    if (!Storage.instance) {
      Storage.instance = new Storage();
    }
    return Storage.instance;
  }

  public get(store: "settings" | "auth", key: string, def?: string): string {
    const storage =
      store === "settings"
        ? process.env.FAIRPOST_STORAGE_SETTINGS
        : (process.env.FAIRPOST_STORAGE_AUTH as "env" | "json");
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
    let value = process.env["FAIRPOST_" + key] ?? "";
    if (!value) {
      if (def === undefined) {
        throw Logger.error("Storage.getEnv: Value " + key + " not found.");
      }
      value = def;
    }
    return value;
  }

  private getJson(key: string, def?: string): string {
    let value = this.jsonData[key] ?? "";
    if (!value) {
      if (def === undefined) {
        throw Logger.error("Storage.getJson: Value " + key + " not found.");
      }
      value = def;
    }
    return value;
  }

  public set(store: "settings" | "auth", key: string, value: string) {
    const storage =
      store === "settings"
        ? process.env.FAIRPOST_STORAGE_SETTINGS
        : (process.env.FAIRPOST_STORAGE_AUTH as "env" | "json");
    switch (storage) {
      case "env":
        return this.setEnv(key, value);
      case "json":
        return this.setJson(key, value);
      default:
        throw Logger.error("Storage " + storage + " not implemented");
    }
  }

  private setEnv(key: string, value: string) {
    const ui = process.env.FAIRPOST_UI;
    if (ui === "cli") {
      console.log("Store this value in your .env file:");
      console.log();
      console.log("FAIRPOST_" + key + "=" + value);
      console.log();
    } else {
      throw Logger.error("Storage.setEnv: UI " + ui + " not implemented");
    }
  }

  private setJson(key: string, value: string) {
    this.jsonData[key] = value;
    this.saveJson();
  }

  private loadJson() {
    const jsonFile =
      process.env.FAIRPOST_STORAGE_JSONPATH || "var/run/storage.json";
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
      process.env.FAIRPOST_STORAGE_JSONPATH || "var/run/storage.json";
    if (!fs.existsSync(jsonFile)) {
      fs.mkdirSync(path.dirname(jsonFile), { recursive: true });
    }
    fs.writeFileSync(jsonFile, JSON.stringify(this.jsonData, null, "\t"));
  }
}

export default Storage.getInstance();
