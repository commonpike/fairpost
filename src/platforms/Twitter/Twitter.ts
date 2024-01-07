import * as sharp from "sharp";

import Folder from "../../models/Folder";
import Logger from "../../services/Logger";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import Storage from "../../services/Storage";
import { TwitterApi } from "twitter-api-v2";
import TwitterAuth from "./TwitterAuth";

/**
 * Twitter: support for twitter platform
 */
export default class Twitter extends Platform {
  id = PlatformId.TWITTER;
  assetsFolder = "_twitter";
  postFileName = "post.json";

  auth: TwitterAuth;

  constructor() {
    super();
    this.auth = new TwitterAuth();
  }

  /** @inheritdoc */
  async setup() {
    return await this.auth.setup();
  }

  /** @inheritdoc */
  async test() {
    Logger.trace("Twitter.test: get oauth1 api");
    const client1 = new TwitterApi({
      appKey: Storage.get("settings", "TWITTER_OA1_API_KEY"),
      appSecret: Storage.get("settings", "TWITTER_OA1_API_KEY_SECRET"),
      accessToken: Storage.get("settings", "TWITTER_OA1_ACCESS_TOKEN"),
      accessSecret: Storage.get("settings", "TWITTER_OA1_ACCESS_SECRET"),
    });
    Logger.trace("Twitter.test: get oauth2 api");
    const client2 = new TwitterApi(Storage.get("auth", "TWITTER_ACCESS_TOKEN"));
    return {
      oauth1: await client1.v1.verifyCredentials(),
      oauth2: await client2.v2.me(),
    };
  }

  /** @inheritdoc */
  async refresh(): Promise<boolean> {
    await this.auth.refresh();
    return true;
  }

  /** @inheritdoc */
  async preparePost(folder: Folder): Promise<Post> {
    Logger.trace("Twitter.preparePost", folder.id);
    const post = await super.preparePost(folder);
    if (post) {
      // twitter: no video
      post.removeFiles("video");
      // twitter: max 4 images
      post.limitFiles("image", 4);
      // twitter: max 5mb images
      for (const file of post.getFiles("image")) {
        const src = file.name;
        const dst = this.assetsFolder + "/twitter-" + src;
        if (file.size / (1024 * 1024) >= 5) {
          Logger.trace("Resizing " + src + " for twitter ..");
          await sharp(post.getFilePath(src))
            .resize({
              width: 1200,
            })
            .toFile(post.getFilePath(dst));
          await post.replaceFile(src, dst);
        }
      }
      post.save();
    }
    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("Twitter.publishPost", post.id, dryrun);

    let response = { data: { id: "-99" } } as {
      data: {
        id: string;
      };
    };
    let error = undefined as Error | undefined;

    if (post.hasFiles("image")) {
      try {
        response = await this.publishImagesPost(post, dryrun);
      } catch (e) {
        error = e as Error;
      }
    } else {
      try {
        response = await this.publishTextPost(post, dryrun);
      } catch (e) {
        error = e as Error;
      }
    }

    return post.processResult(
      response.data.id,
      "https://twitter.com/user/status/" + response.data.id,
      {
        date: new Date(),
        dryrun: dryrun,
        success: !error,
        error: error,
        response: response,
      },
    );
  }

  /**
   * tweet body using oauth2 client
   * @param post - the post
   * @param dryrun - wether to really execure
   * @returns object, incl. id of the created post
   */
  private async publishTextPost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{
    data: {
      id: string;
    };
  }> {
    Logger.trace("Twitter.publishTextPost", post.id, dryrun);
    if (!dryrun) {
      const client2 = new TwitterApi(
        Storage.get("auth", "TWITTER_ACCESS_TOKEN"),
      );
      const result = await client2.v2.tweet({
        text: post.getCompiledBody(),
      });
      if (result.errors) {
        throw Logger.error(result.errors.join());
      }
      return result;
    }
    return {
      data: {
        id: "-99",
      },
    };
  }

  /**
   * Upload a images to twitter using oauth1 client
   * and create a post with body & media using oauth2 client
   * @param post - the post to publish
   * @param dryrun - wether to actually post it
   * @returns object incl id of the created post
   */
  private async publishImagesPost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{
    data: {
      id: string;
    };
  }> {
    Logger.trace("Twitter.publishImagesPost", post.id, dryrun);

    const client1 = new TwitterApi({
      appKey: Storage.get("settings", "TWITTER_OA1_API_KEY"),
      appSecret: Storage.get("settings", "TWITTER_OA1_API_KEY_SECRET"),
      accessToken: Storage.get("settings", "TWITTER_OA1_ACCESS_TOKEN"),
      accessSecret: Storage.get("settings", "TWITTER_OA1_ACCESS_SECRET"),
    });
    const mediaIds = [];

    for (const image of post.getFiles("image")) {
      const path = post.getFilePath(image.name);
      Logger.trace("Uploading " + path + "...");
      try {
        mediaIds.push(await client1.v1.uploadMedia(path));
      } catch (e) {
        throw Logger.error("Twitter.publishPost uploadMedia failed", e);
      }
    }

    const client2 = new TwitterApi(Storage.get("auth", "TWITTER_ACCESS_TOKEN"));

    if (!dryrun) {
      Logger.trace("Tweeting " + post.id + "...");
      const result = await client2.v2.tweet({
        text: post.getCompiledBody(),
        media: { media_ids: mediaIds },
      });
      if (result.errors) {
        throw Logger.error(result.errors.join());
      }
      return result;
    }

    return {
      data: {
        id: "-99",
      },
    };
  }
}
