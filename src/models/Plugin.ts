import Platform from "./Platform";
import Post from "./Post";

/**
 * Plugin - base class to extend plugins from
 *
 * A plugins processes a post during Platform.preparePost,
 * based on its settings for that platform, eg to make
 * black and white images on Facebook but colored ones
 * on Instagram.
 *
 */
export default class Plugin {
  id: string;
  settings: object;

  constructor(platform: Platform) {
    this.id = this.constructor.name;
    platform.user.trace(platform.id, "Add plugin", this.id);
    this.settings = {}; // todo
  }

  /**
   * Return a small report for this post
   * @returns the report in text
   */

  report(): string {
    let report = "";
    report += "\nPlugin: " + this.id;
    return report;
  }

  /**
   * Extend default settings for one platform
   */

  //getPlatformSettings(platformId: PlatformId): object {
  //  return { ...this.settings.default, ...this.settings[platformId] }
  //}

  /**
   * Process the post
   */

  async process(post: Post): Promise<void> {
    throw post.platform.user.error(
      "process() not implemented for Plugin'" +
        this.id +
        "'. Read the docs in the docs folder.",
    );
  }
}
