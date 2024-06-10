import Platform from "../models/Platform";
import { PlatformId } from "../platforms";
import Plugin from "../models/Plugin";
import Post from "../models/Post";
import untypedDefaults from "./ImageSize.defaults.json";

/**
 * Plugin ImageSize.
 *
 * Resize images from Post based on Platform limits.
 *
 */

type ImageSizeSettings = {
  fit?: string; // 'cover' | 'contain';
  bgcolor?: string;
  min_size?: number;
  max_size?: number;
  min_ratio?: number;
  max_ratio?: number;
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
};

export default class ImageSize extends Plugin {
  constructor(platform: Platform) {
    super(platform);
    const defaults: { [key in PlatformId | "default"]?: ImageSizeSettings } =
      untypedDefaults;
    this.settings = {
      ...defaults["default"],
      ...(defaults[platform.id] ?? {}),
    };
  }

  /**
   * Process the post
   */

  process(post: Post): void {
    post.platform.user.trace(this.id, post.id, "process");
  }
}
