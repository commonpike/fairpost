import * as fs from "fs";
import * as sharp from "sharp";

import Ayrshare from "../Ayrshare";
import Folder from "../../models/Folder";
import Logger from "../../services/Logger";
import { PlatformId } from "..";
import Post from "../../models/Post";

/**
 * AsTwitter: support for twitter platform through Ayrshare
 */
export default class AsTwitter extends Ayrshare {
  id = PlatformId.ASTWITTER;

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post) {
      // twitter: no video
      post.files.video = [];
      // twitter: max 4 images
      if (post.files.image.length > 4) {
        post.files.image.length = 4;
      }
      // twitter: max 5mb images
      for (const src of post.files.image) {
        const dst = this.assetsFolder() + "/twitter-" + src;
        const size = fs.statSync(post.getFullPath(src)).size / (1024 * 1024);
        if (size >= 5) {
          Logger.trace("Resizing " + src + " for twitter ..");
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
