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
  assetsFolder = "_asinstagram";
  postFileName = "post.json";

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post && post.files) {
      if (post.getFiles("video").length > 10) {
        Logger.trace("Removing > 10 videos for instagram caroussel..");
        post.limitFiles("video", 10);
      }
      const remaining = 10 - post.getFiles("video").length;
      if (post.getFiles("image").length > remaining) {
        Logger.trace("Removing some images for instagram caroussel..");
        post.limitFiles("image", remaining);
      }

      // instagram : scale images, jpeg only
      for (const file of post.getFiles("image")) {
        const src = file.name;
        if (file.width > 1440) {
          Logger.trace("Resizing " + src + " for instagram ..");
          const dst =
            this.assetsFolder + "/instagram-" + file.basename + ".JPEG";
          await sharp(post.getFilePath(src))
            .resize({
              width: 1440,
            })
            .toFile(post.getFilePath(dst));
          await post.replaceFile(src, dst);
        }
      }

      // instagram: require media
      if (!post.hasFiles("image", "video")) {
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
        isVideo: post.hasFiles("video"),
        instagramOptions: {
          // "autoResize": true -- only enterprise plans
        },
      },
      dryrun,
    );
  }
}
