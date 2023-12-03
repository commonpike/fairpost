import * as fs from "fs";
import * as sharp from "sharp";

import Post, { PostStatus } from "../models/Post";

import Folder from "../models/Folder";
import Logger from "../services/Logger";
import Platform from "../models/Platform";
import { PlatformId } from ".";
import Storage from "../services/Storage";
import { TwitterApi } from "twitter-api-v2";
import TwitterAuth from "../auth/TwitterAuth";

/**
 * Twitter: support for twitter platform
 */
export default class Twitter extends Platform {
  id = PlatformId.TWITTER;

  constructor() {
    super();
  }

  /** @inheritdoc */
  async setup() {
    const auth = new TwitterAuth();
    return await auth.setup();
  }

  /** @inheritdoc */
  async test() {
    const client1 = new TwitterApi({
      appKey: Storage.get("settings", "TWITTER_OA1_API_KEY"),
      appSecret: Storage.get("settings", "TWITTER_OA1_API_KEY_SECRET"),
      accessToken: Storage.get("settings", "TWITTER_OA1_ACCESS_TOKEN"),
      accessSecret: Storage.get("settings", "TWITTER_OA1_ACCESS_SECRET"),
    });
    const client2 = new TwitterApi(Storage.get("auth", "TWITTER_ACCESS_TOKEN"));
    return {
      oauth1: await client1.v1.verifyCredentials(),
      oauth2: await client2.v2.me(),
    };
  }

  async preparePost(folder: Folder): Promise<Post> {
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
    const client1 = new TwitterApi({
      appKey: Storage.get("settings", "TWITTER_OA1_API_KEY"),
      appSecret: Storage.get("settings", "TWITTER_OA1_API_KEY_SECRET"),
      accessToken: Storage.get("settings", "TWITTER_OA1_ACCESS_TOKEN"),
      accessSecret: Storage.get("settings", "TWITTER_OA1_ACCESS_SECRET"),
    });

    let error = undefined;
    let result = undefined;
    const mediaIds = [];
    if (post.files.image.length) {
      for (const image of post.files.image) {
        const path = post.folder.path + "/" + image;
        Logger.trace("Uploading " + path + "...");
        try {
          mediaIds.push(await client1.v1.uploadMedia(path));
        } catch (e) {
          Logger.warn("Twitter.publishPost uploadMedia failed", e);
          error = e;
        }
      }
    }

    const client2 = new TwitterApi(Storage.get("auth", "TWITTER_ACCESS_TOKEN"));

    if (!dryrun) {
      if (!error) {
        Logger.trace("Tweeting " + post.id + "...");
        try {
          result = await client2.v2.tweet({
            text: post.body,
            media: { media_ids: mediaIds },
          });
          if (result.errors) {
            error = new Error(result.errors.join());
          }
        } catch (e) {
          error = e;
        }
      }
    } else {
      result = {
        id: "99",
      };
    }

    post.results.push({
      date: new Date(),
      dryrun: dryrun,
      success: !error,
      error: error,
      response: result,
    });

    if (error) {
      Logger.warn("Twitter.publishPost", this.id, "failed", error, result);
    }

    if (!dryrun) {
      if (!error) {
        post.link = "https://twitter.com/user/status/" + result.data.id;
        post.status = PostStatus.PUBLISHED;
        post.published = new Date();
      } else {
        post.status = PostStatus.FAILED;
      }
    }

    post.save();
    return !error;
  }
}
