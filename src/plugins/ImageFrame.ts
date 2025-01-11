import { FileGroup, FileInfo } from "../models/Source";

import Plugin from "../models/Plugin";
import Post from "../models/Post";
import sharp from "sharp";

/**
 * Plugin ImageFrame.
 *
 * Add single or double border around images from Post
 *
 */

interface ImageFrameSettings {
  inner_width: string | number; // set to 0 or "" to ignore
  inner_color: string; // css color
  outer_width: string | number; // set to 0 or "" to ignore
  outer_color: string; // css color
}

// https://sharp.pixelplumbing.com/api-resize#extend

export default class ImageFrame extends Plugin {
  static defaults: ImageFrameSettings = {
    inner_width: "1%",
    inner_color: "black",
    outer_width: "9%",
    outer_color: "white",
  };
  settings: ImageFrameSettings;

  constructor(settings?: object) {
    super();
    this.settings = {
      ...ImageFrame.defaults,
      ...(settings ?? {}),
    };
  }

  /**
   * Process the post
   */

  async process(post: Post): Promise<void> {
    post.platform.user.trace(this.id, post.id, "process");
    for (const file of post.getFiles(FileGroup.IMAGE)) {
      await this.addImageFrame(post, file);
    }
  }

  private async addImageFrame(post: Post, file: FileInfo) {
    if (file.width && file.height) {
      const size = Math.min(file.width, file.height);
      const newFileName = file.basename + "-framed." + file.extension;
      const src = file.name;
      const dst = post.platform.assetsFolder + "/" + newFileName;

      const source = sharp(post.getFilePath(src));

      let innerBuffer = await source.toBuffer();
      if (this.settings.inner_width) {
        let inner_width = 0;
        if (typeof this.settings.inner_width === "string") {
          if (this.settings.inner_width.endsWith("%")) {
            inner_width = Math.round(
              (size * parseInt(this.settings.inner_width)) / 100,
            );
          } else {
            inner_width = parseInt(this.settings.inner_width);
          }
        } else {
          inner_width = this.settings.inner_width;
        }
        innerBuffer = await source
          .extend({
            top: inner_width,
            bottom: inner_width,
            left: inner_width,
            right: inner_width,
            background: this.settings.inner_color,
          })
          .toBuffer();
      }

      let outerBuffer = innerBuffer;
      if (this.settings.outer_width) {
        let outer_width = 0;
        if (typeof this.settings.outer_width === "string") {
          if (this.settings.outer_width.endsWith("%")) {
            outer_width = Math.round(
              (size * parseInt(this.settings.outer_width)) / 100,
            );
          } else {
            outer_width = parseInt(this.settings.outer_width);
          }
        } else {
          outer_width = this.settings.outer_width;
        }
        outerBuffer = await sharp(innerBuffer)
          .extend({
            top: outer_width,
            bottom: outer_width,
            left: outer_width,
            right: outer_width,
            background: this.settings.outer_color,
          })
          .toBuffer();
      }
      await sharp(outerBuffer).toFile(post.getFilePath(dst));
      await post.replaceFile(src, dst);
    }
  }
}
