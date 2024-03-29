import Ayrshare from "./Ayrshare";
import Folder from "../../models/Folder";
import { PlatformId } from "..";
import Post from "../../models/Post";
import User from "../../models/User";

/**
 * AsReddit: support for reddit platform through Ayrshare
 */
export default class AsReddit extends Ayrshare {
  id = PlatformId.ASREDDIT;
  assetsFolder = "_asreddit";
  postFileName = "post.json";

  SUBREDDIT: string;

  constructor(user: User) {
    super(user);
    this.SUBREDDIT = this.user.get("settings", "AYRSHARE_SUBREDDIT", "");
  }

  async preparePost(folder: Folder): Promise<Post> {
    const post = await super.preparePost(folder);
    if (post) {
      // reddit: max 1 image, no video
      post.removeFiles("video");
      post.limitFiles("image", 1);
      post.save();
    }
    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    return super.publishAyrshare(
      post,
      {
        redditOptions: {
          title: post.title, // required
          subreddit: this.SUBREDDIT, // required (no "/r/" needed)
        },
      },
      dryrun,
    );
  }
}
