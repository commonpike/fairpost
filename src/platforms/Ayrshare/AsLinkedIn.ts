import * as fs from "fs";
import * as sharp from "sharp";

import Ayrshare from "../Ayrshare";
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
      for (const image of post.files.image) {
        const size =
          fs.statSync(post.folder.path + "/" + image).size / (1024 * 1024);
        if (size >= 5) {
          Logger.trace("Resizing " + image + " for linkedin ..");
          await sharp(post.folder.path + "/" + image)
            .resize({
              width: 1200,
            })
            .toFile(post.folder.path + "/_linkedin-" + image);
          post.files.image.push("_linkedin-" + image);
          post.files.image = post.files.image.filter((file) => file !== image);
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
