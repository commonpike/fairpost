import * as sharp from "sharp";

import Ayrshare from "./Ayrshare";
import Folder from "../../models/Folder";
import { PlatformId } from "..";
import Post from "../../models/Post";

/**
 * AsFacebook: support for facebook platform through Ayrshare
 */
export default class AsFacebook extends Ayrshare {
  id: PlatformId = PlatformId.ASFACEBOOK;
  assetsFolder = "_asfacebook";
  postFileName = "post.json";

  async preparePost(folder: Folder): Promise<Post> {
    const post = await super.preparePost(folder);
    if (post) {
      // facebook : max 10mb images
      for (const file of post.getFiles("image")) {
        const src = file.name;
        const dst = this.assetsFolder + "/facebook-" + src;
        if (file.size / (1024 * 1024) >= 10) {
          console.log("Resizing " + src + " for facebook ..");
          await sharp(post.getFilePath(src))
            .resize({
              width: 1200,
            })
            .toFile(post.getFilePath(dst));
          await post.replaceFile(src, dst);
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
