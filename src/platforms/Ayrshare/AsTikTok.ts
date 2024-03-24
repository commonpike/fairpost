import Ayrshare from "./Ayrshare";
import Folder from "../../models/Folder";
import { PlatformId } from "..";
import Post from "../../models/Post";

/**
 * AsTikTok: support for tiktok platform through Ayrshare
 */
export default class AsTikTok extends Ayrshare {
  id = PlatformId.ASTIKTOK;
  assetsFolder = "_astiktok";
  postFileName = "post.json";

  async preparePost(folder: Folder): Promise<Post> {
    const post = await super.preparePost(folder);
    if (post) {
      // tiktok: one video
      post.removeFiles("image");
      if (!post.hasFiles("video")) {
        post.valid = false;
      } else {
        post.limitFiles("video", 1);
      }
      post.save();
    }
    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    return super.publishAyrshare(post, {}, dryrun);
  }
}
