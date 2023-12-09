import * as path from "path";
import * as sharp from "sharp";

import Ayrshare from "./Ayrshare";
import Folder from "../../models/Folder";
import Logger from "../../services/Logger";
import { PlatformId } from "..";
import Post from "../../models/Post";

/**
 * AsInstagram: support for instagram platform through Ayrshare
 */
export default class AsInstagram extends Ayrshare {
  id = PlatformId.ASINSTAGRAM;

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post && post.files) {
      // instagram: 1 video for reel
      if (post.files.video.length) {
        if (post.files.video.length > 10) {
          Logger.trace("Removing > 10 videos for instagram caroussel..");
          post.files.video.length = 10;
        }
        const remaining = 10 - post.files.video.length;
        if (post.files.image.length > remaining) {
          Logger.trace("Removing some images for instagram caroussel..");
          post.files.image.length = remaining;
        }
      }

      // instagram : scale images, jpeg only
      for (const src of post.files.image) {
        const metadata = await sharp(post.getFullPath(src)).metadata();
        if (metadata.width > 1440) {
          Logger.trace("Resizing " + src + " for instagram ..");
          const extension = src.split(".")?.pop();
          const basename = path.basename(src, extension ? "." + extension : "");
          const dst = this.assetsFolder() + "/instagram-" + basename + ".JPEG";
          await sharp(post.getFullPath(src))
            .resize({
              width: 1440,
            })
            .toFile(post.getFullPath(dst));
          post.useAlternativeFile(src, dst);
        }
      }

      // instagram: require media
      if (post.files.image.length + post.files.video.length === 0) {
        post.valid = false;
      }
      post.save();
    }
    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    return super.publishAyrshare(
      post,
      {
        isVideo: post.files.video.length !== 0,
        instagramOptions: {
          // "autoResize": true -- only enterprise plans
        },
      },
      dryrun,
    );
  }
}
