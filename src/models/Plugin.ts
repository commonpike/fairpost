import Post from "./Post";

/**
 * Plugin - base class to extend plugins from
 *
 * A plugins processes a post during Platform.preparePost,
 * based on the given settings, eg to make
 * black and white images on Facebook but colored ones
 * on Instagram.
 *
 */
export default class Plugin {
  static defaults: object = {};
  id: string;

  constructor() {
    this.id = this.constructor.name.toLowerCase();
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
