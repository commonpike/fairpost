import * as platformClasses from "../platforms";

import Feed from "../models/Feed";
import Platform from "../models/Platform";
import Storage from "./Storage";

/**
 * Fairpost - singleton service for fairpost app
 *
 * - provides the feed, that contains
 *   all the fairpost logic
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
    const activePlatformIds = Storage.get(
      "settings",
      "FEED_PLATFORMS",
      "",
    ).split(",");

    Object.values(platformClasses).forEach((platformClass) => {
      if (typeof platformClass === "function") {
        const platform = new platformClass();
        platform.active = activePlatformIds.includes(platform.id);
        this.platforms.push(platform);
      }
    });
  }

  public getFeed() {
    return new Feed(this.platforms.filter((p) => p.active));
  }
}

export default Fairpost.getInstance();
