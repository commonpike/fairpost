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
  assetsFolder = "_aslinkedin";
  postFileName = "post.json";

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post) {
      // linkedin: max 9 media
      if (post.getFiles("video").length > 9) {
        post.limitFiles("video", 9);
      }
      const remaining = 9 - post.getFiles("video").length;
      if (post.getFiles("image").length > remaining) {
        post.limitFiles("image", remaining);
      }
      // linkedin: max 5mb images
      for (const file of post.getFiles("image")) {
        const src = file.name;
        const dst = this.assetsFolder + "/linkedin-" + src;
        if (file.size / (1024 * 1024) >= 5) {
          Logger.trace("Resizing " + src + " for linkedin ..");
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
