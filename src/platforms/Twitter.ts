import TwitterAuth from "../auth/TwitterAuth";
import { PlatformId } from ".";
import Platform from "../core/Platform";
import Folder from "../core/Folder";
import Post from "../core/Post";

/**
 * AsYouTube: support for youtube platform through Ayrshare
 */
export default class Twitter extends Platform {
  id = PlatformId.TWITTER;

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post> {
    const post = await super.preparePost(folder);
    if (post) {
      // ....
      post.save();
    }
    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    return super.publishPost(post, dryrun);
  }

  async test() {
    return "not implemented";
  }

  async setup() {
    const auth = new TwitterAuth();
    return await auth.setup();
  }
}
