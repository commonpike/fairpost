import Logger from "../Logger";
import Ayrshare from "./Ayrshare";
import { PlatformId } from ".";
import Folder from "../Folder";
import Post from "../Post";
import * as fs from "fs";
import * as sharp from "sharp";

export default class AsTwitter extends Ayrshare {
  id = PlatformId.ASTWITTER;

  constructor() {
    super();
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post) {
      // twitter: no video
      post.files.video = [];
      // twitter: max 4 images
      if (post.files.image.length > 4) {
        post.files.image.length = 4;
      }
      // twitter: max 5mb images
      for (const image of post.files.image) {
        const size =
          fs.statSync(post.folder.path + "/" + image).size / (1024 * 1024);
        if (size >= 5) {
          Logger.trace("Resizing " + image + " for twitter ..");
          await sharp(post.folder.path + "/" + image)
            .resize({
              width: 1200,
            })
            .toFile(post.folder.path + "/_twitter-" + image);
          post.files.image.push("_twitter-" + image);
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
