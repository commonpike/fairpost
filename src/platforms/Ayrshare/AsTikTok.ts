import Ayrshare from "../Ayrshare";
import { PlatformId } from "..";
import Folder from "../../core/Folder";
import Post from "../../core/Post";

/**
 * AsTikTok: support for tiktok platform through Ayrshare
 */
export default class AsTikTok extends Ayrshare {
  id = PlatformId.ASTIKTOK;

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post) {
      // tiktok: one video
      post.files.image = [];
      if (!post.files.video.length) {
        post.valid = false;
      } else {
        post.files.video.length = 1;
      }
      post.save();
    }
    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    return super.publishAyrshare(post, {}, dryrun);
  }
}