import Ayrshare from "./Ayrshare";
import Folder from "../../models/Folder";
import { PlatformId } from "..";
import Post from "../../models/Post";

/**
 * AsYouTube: support for youtube platform through Ayrshare
 */
export default class AsYouTube extends Ayrshare {
  id = PlatformId.ASYOUTUBE;
  assetsFolder = "_asyoutube";
  postFileName = "post.json";

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post> {
    const post = await super.preparePost(folder);
    if (post) {
      // youtube: only 1 video
      post.removeFiles("image");
      post.limitFiles("video", 1);
      if (!post.hasFiles("video")) {
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
