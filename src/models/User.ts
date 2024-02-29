import * as platformClasses from "../platforms";

import Feed from "./Feed";
import Logger from "../services/Logger";
import Platform from "./Platform";
import Store from "./Store";

/**
 * User - represents one fairpost user with
 *
 * - getters and setters for key / value pairs, all string.
 *
 */

export default class User {
  id: string;
  homedir: string;
  platforms = [] as Platform[];
  store: Store;

  jsonData: { [key: string]: string } = {};
  envData: { [key: string]: string } = {};

  constructor(id: string = "default") {
    this.id = id;
    this.store = new Store(this.id);
    this.homedir = this.get("settings", "USER_HOMEDIR", "users/%user%").replace(
      "%user%",
      this.id,
    );
  }

  /**
   * Return a small report for this feed
   * @returns the report in text
   */

  report(): string {
    Logger.trace("User", "report");
    let report = "";
    report += "\nUser: " + this.id;
    report += "\n - homedir: " + this.homedir;
    return report;
  }

  /**
   * @returns the feed for this user
   */

  public getFeed(): Feed {
    this.loadPlatforms();
    return new Feed(this);
  }

  /**
   * Load all available platforms, and set
   * those that are active in the settings,
   * active
   */
  private loadPlatforms(): void {
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

  public get(store: "settings" | "auth", key: string, def?: string): string {
    try {
      return this.store.get(store, key, def);
    } catch (error) {
      throw Logger.error(error);
    }
  }

  public set(store: "settings" | "auth", key: string, value: string) {
    try {
      return this.store.set(store, key, value);
    } catch (error) {
      throw Logger.error(error);
    }
  }
}
