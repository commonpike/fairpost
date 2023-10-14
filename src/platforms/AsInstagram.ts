import Logger from "../Logger";
import Ayrshare from "./Ayrshare";
import { PlatformId } from ".";
import Folder from "../Folder";
import Post from "../Post";
import * as sharp from "sharp";

export default class AsInstagram extends Ayrshare {
  id = PlatformId.ASINSTAGRAM;

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post) {
      // instagram: 1 video for reel
      if (post.files.video.length) {
        Logger.trace("Removing images for instagram reel..");
        post.files.image = [];
        if (post.files.video.length > 1) {
          Logger.trace("Using first video for instagram reel..");
          post.files.video = [post.files.video[0]];
        }
      }
      // instagram : scale images
      for (const image of post.files.image) {
        const metadata = await sharp(post.folder.path + "/" + image).metadata();
        if (metadata.width > 1440) {
          Logger.trace("Resizing " + image + " for instagram ..");
          await sharp(post.folder.path + "/" + image)
            .resize({
              width: 1440,
            })
            .toFile(post.folder.path + "/_instagram-" + image);
          post.files.image.push("_instagram-" + image);
          post.files.image = post.files.image.filter((file) => file !== image);
        }
      }
      // instagram: require media
      if (post.files.image.length + post.files.video.length === 0) {
        post.valid = false;
      }
      post.save();
    }
    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    return super.publishPost(
      post,
      {
        isVideo: post.files.video.length !== 0,
        instagramOptions: {
          // "autoResize": true -- only enterprise plans
        },
      },
      dryrun,
    );
  }
}
