import * as fs from "fs";
import * as sharp from "sharp";

import Ayrshare from "./Ayrshare";
import Folder from "../../models/Folder";
import Logger from "../../services/Logger";
import { PlatformId } from "..";
import Post from "../../models/Post";

/**
 * AsLinkedIn: support for linkedin platform through Ayrshare
 */
export default class AsLinkedIn extends Ayrshare {
  id = PlatformId.ASLINKEDIN;

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post) {
      // linkedin: max 9 media
      if (post.files.video.length > 9) {
        post.files.video.length = 9;
      }
      if (post.files.image.length + post.files.video.length > 9) {
        post.files.image.length = Math.max(
          0,
          post.files.image.length - post.files.video.length,
        );
      }
      // linkedin: max 5mb images
      for (const src of post.files.image) {
        const dst = this.assetsFolder() + "/linkedin-" + src;
        const size = fs.statSync(post.getFullPath(src)).size / (1024 * 1024);
        if (size >= 5) {
          Logger.trace("Resizing " + src + " for linkedin ..");
          await sharp(post.getFullPath(src))
            .resize({
              width: 1200,
            })
            .toFile(post.getFullPath(dst));
          post.useAlternativeFile(src, dst);
        }
      }
      post.save();
    }
    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    return super.publishAyrshare(post, {}, dryrun);
  }
}
