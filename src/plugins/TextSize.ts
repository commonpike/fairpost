import Plugin from "../models/Plugin.ts";
import Post from "../models/Post.ts";

interface TextSizeSettings {
  min_length?: number;
  max_length?: number;
}

/**
 * Plugin ImageSize.
 *
 * Resize images from Post based on Platform limits.
 *
 */
export default class TextSize extends Plugin {
  static defaults: TextSizeSettings = {
    min_length: 0,
    max_length: 0,
  };
  settings: TextSizeSettings;

  constructor(settings?: object) {
    super();
    this.settings = {
      ...TextSize.defaults,
      ...(settings ?? {}),
    };
  }

  /**
   * Process the post
   */

  async process(post: Post): Promise<void> {
    post.platform.user.log.trace(this.id, post.id, "process");
    if (
      this.settings.max_length &&
      post.body &&
      post.body.length >= this.settings.max_length
    ) {
      const splitBody = post.body.match(/[^.\n]+[.\n]*|[.\n]+/g);
      if (splitBody) {
        let newBody = "";
        let nextLine = splitBody.shift();
        while (
          nextLine &&
          newBody.length + nextLine.length < this.settings.max_length
        ) {
          newBody += nextLine;
          nextLine = splitBody.shift();
        }
        if (newBody !== "") {
          post.body = newBody;
        }
      }
      if (post.body.length >= this.settings.max_length) {
        post.body =
          post.body.substring(0, this.settings.max_length - 4) + "...";
      }
    }
  }
}
