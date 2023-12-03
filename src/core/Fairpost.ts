import * as fs from "fs";
import * as path from "path";
import Feed from "./Feed";
import Platform from "./Platform";
import Storage from "./Storage";
import Logger from "./Logger";
import * as platforms from "../platforms";

/**
 * Fairpost - singleton service for fairpost app
 *
 * - provides getFeed()
 *   all the fairpost logic comes from a feed
 */

class Fairpost {
  static instance: Fairpost;

  platforms = [] as Platform[];

  constructor() {
    if (Fairpost.instance) {
      throw new Error("Fairpost: call getInstance() instead");
    }
    this.loadPlatforms();
  }

  static getInstance(): Fairpost {
    if (!Fairpost.instance) {
      Fairpost.instance = new Fairpost();
    }
    return Fairpost.instance;
  }

  public loadPlatforms() {
    const activePlatformIds = Storage.get("settings", "FEED_PLATFORMS").split(
      ",",
    );

    const platformClasses = fs.readdirSync(
      path.resolve(__dirname + "/../platforms"),
    );

    platformClasses.forEach((file) => {
      const constructor = file.replace(".ts", "").replace(".js", "");
      // nb import * as platforms loaded the constructors
      if (platforms[constructor] !== undefined) {
        const platform = new platforms[constructor]();
        platform.active = activePlatformIds.includes(platform.id);
        this.platforms.push(platform);
      }
    });
  }

  public getFeed() {
    return new Feed(this.platforms.filter((p) => p.active));
  }

  public fatal(msg: string) {
    Logger.fatal(msg);
    throw new Error(msg);
  }
}

export default Fairpost.getInstance();
