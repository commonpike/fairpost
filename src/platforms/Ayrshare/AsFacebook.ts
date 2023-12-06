import * as fs from "fs";
import * as sharp from "sharp";

import Ayrshare from "../Ayrshare";
import Folder from "../../models/Folder";
import { PlatformId } from "..";
import Post from "../../models/Post";

/**
 * AsFacebook: support for facebook platform through Ayrshare
 */
export default class AsFacebook extends Ayrshare {
  id: PlatformId = PlatformId.ASFACEBOOK;

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post) {
      // facebook : max 10mb images
      for (const src of post.files.image) {
        const dst = this.assetsFolder() + "/facebook-" + src;
        const size = fs.statSync(post.getFullPath(src)).size / (1024 * 1024);
        if (size >= 10) {
          console.log("Resizing " + src + " for facebook ..");
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
