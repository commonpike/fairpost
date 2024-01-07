import * as sharp from "sharp";

import Ayrshare from "./Ayrshare";
import Folder from "../../models/Folder";
import Logger from "../../services/Logger";
import { PlatformId } from "..";
import Post from "../../models/Post";

/**
 * AsTwitter: support for twitter platform through Ayrshare
 */
export default class AsTwitter extends Ayrshare {
  id = PlatformId.ASTWITTER;
  assetsFolder = "_astwitter";
  postFileName = "post.json";

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post> {
    const post = await super.preparePost(folder);
    if (post) {
      // twitter: no video
      post.removeFiles("video");
      // twitter: max 4 images
      post.limitFiles("video", 4);
      // twitter: max 5mb images
      for (const file of post.getFiles("image")) {
        const src = file.name;
        const dst = this.assetsFolder + "/twitter-" + src;
        if (file.size / (1024 * 1024) >= 5) {
          Logger.trace("Resizing " + src + " for twitter ..");
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
