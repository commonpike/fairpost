import Platform from "../models/Platform";
import Plugin from "../models/Plugin";
import Post from "../models/Post";

/**
 * Plugin ImageSize.
 *
 * Remove files from Post based on Platform limits.
 *
 */

/*
type LimitFilesSettings = {
    prefer_type?: "image" | "video" | "text" | "other";
    strict_type?: boolean;
    total_max?: number;
    total_min?: number;
    image_min?: number;
    image_max?: number;
    video_min?: number;
    video_max?: number;
    text_min?: number;
    text_max?: number;
    other_min?: number;
    other_max?: number;
};*/

export default class ImageSize extends Plugin {
  constructor(platform: Platform) {
    super(platform);
  }

  /**
   * Process the post
   */

  process(post: Post): void {
    this.platform.user.trace(this.id, post.id, "process");
  }
}
