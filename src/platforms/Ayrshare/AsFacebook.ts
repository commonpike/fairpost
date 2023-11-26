import Ayrshare from "../Ayrshare";
import { PlatformId } from "..";
import Folder from "../../core/Folder";
import Post from "../../core/Post";
import * as fs from "fs";
import * as sharp from "sharp";

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
      for (const image of post.files.image) {
        const size =
          fs.statSync(post.folder.path + "/" + image).size / (1024 * 1024);
        if (size >= 10) {
          console.log("Resizing " + image + " for facebook ..");
          await sharp(post.folder.path + "/" + image)
            .resize({
              width: 1200,
            })
            .toFile(post.folder.path + "/_facebook-" + image);
          post.files.image.push("_facebook-" + image);
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
