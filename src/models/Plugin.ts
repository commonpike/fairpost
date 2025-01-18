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
    this.id = (this.constructor as typeof Plugin).id();
  }

  /**
   * Return the id of this plugin as used in settings.
   * By default, this is the lowercase name of the class,
   * but you can override this in your own platform.
   * @returns the id
   */
  static id(): string {
    return this.name.toLowerCase() as string;
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
      this.id,
      "process() not implemented. Read the docs in the docs folder.",
    );
  }
}
