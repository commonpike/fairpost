import Ayrshare from "./Ayrshare";
import { PlatformId } from ".";
import Folder from "../core/Folder";
import Post from "../core/Post";

/**
 * AsYouTube: support for youtube platform through Ayrshare
 */
export default class AsYouTube extends Ayrshare {
  id = PlatformId.ASYOUTUBE;

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post) {
      // youtube: only 1 video
      post.files.image = [];
      if (post.files.video.length > 1) {
        post.files.video.length = 1;
      }
      if (!post.files.video.length) {
        post.valid = false;
      }
      post.save();
    }
    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    return super.publishAyrshare(
      post,
      {
        youTubeOptions: {
          title: post.title, // required max 100
          visibility: "public", // optional def private
        },
      },
      dryrun,
    );
  }
}
