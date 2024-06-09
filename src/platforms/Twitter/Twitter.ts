import Folder from "../../models/Folder";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import { TwitterApi } from "twitter-api-v2";
import TwitterAuth from "./TwitterAuth";
import User from "../../models/User";
import sharp from "sharp";

/**
 * Twitter: support for twitter platform
 */
export default class Twitter extends Platform {
  id = PlatformId.TWITTER;
  assetsFolder = "_twitter";
  postFileName = "post.json";

  auth: TwitterAuth;

  constructor(user: User) {
    super(user);
    this.auth = new TwitterAuth(user);
  }

  /** @inheritdoc */
  async setup() {
    return await this.auth.setup();
  }

  /** @inheritdoc */
  async test() {
    this.user.trace("Twitter.test: get oauth1 api");
    const client1 = new TwitterApi({
      appKey: this.user.get("settings", "TWITTER_OA1_API_KEY"),
      appSecret: this.user.get("settings", "TWITTER_OA1_API_KEY_SECRET"),
      accessToken: this.user.get("settings", "TWITTER_OA1_ACCESS_TOKEN"),
      accessSecret: this.user.get("settings", "TWITTER_OA1_ACCESS_SECRET"),
    });
    const creds1 = await client1.v1.verifyCredentials();
    this.user.trace("Twitter.test: get oauth2 api");
    const client2 = new TwitterApi(
      this.user.get("auth", "TWITTER_ACCESS_TOKEN"),
    );
    const creds2 = await client2.v2.me();
    return {
      oauth1: {
        id: creds1["id"],
        name: creds1["name"],
        screen_name: creds1["screen_name"],
        url: creds1["url"],
      },
      oauth2: creds2["data"],
    };
  }

  /** @inheritdoc */
  async refresh(): Promise<boolean> {
    await this.auth.refresh();
    return true;
  }

  /** @inheritdoc */
  async preparePost(folder: Folder): Promise<Post> {
    this.user.trace("Twitter.preparePost", folder.id);
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
          this.user.trace("Resizing " + src + " for twitter ..");
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
    this.user.trace("Twitter.publishPost", post.id, dryrun);

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
    this.user.trace("Twitter.publishTextPost", post.id, dryrun);
    if (!dryrun) {
      const client2 = new TwitterApi(
        this.user.get("auth", "TWITTER_ACCESS_TOKEN"),
      );
      const result = await client2.v2.tweet({
        text: post.getCompiledBody(),
      });
      if (result.errors) {
        throw this.user.error(result.errors.join());
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
    this.user.trace("Twitter.publishImagesPost", post.id, dryrun);

    const client1 = new TwitterApi({
      appKey: this.user.get("settings", "TWITTER_OA1_API_KEY"),
      appSecret: this.user.get("settings", "TWITTER_OA1_API_KEY_SECRET"),
      accessToken: this.user.get("settings", "TWITTER_OA1_ACCESS_TOKEN"),
      accessSecret: this.user.get("settings", "TWITTER_OA1_ACCESS_SECRET"),
    });
    const mediaIds = [];

    const additionalOwner = this.user.get(
      "settings",
      "TWITTER_OA1_ADDITIONAL_OWNER",
      "",
    );
    for (const image of post.getFiles("image")) {
      const path = post.getFilePath(image.name);
      this.user.trace("Uploading " + path + "...");
      try {
        mediaIds.push(
          await client1.v1.uploadMedia(path, {
            // mimeType : '' //MIME type as a string. To help you across allowed MIME types, enum EUploadMimeType is here for you. This option is required if file is not specified as string.
            // target: 'tweet' //Target type tweet or dm. Defaults to tweet. You must specify it if you send a media to use in DMs.
            // longVideo : false //Specify true here if you're sending a video and it can exceed 120 seconds. Otherwise, this option has no effet.
            // shared: false //Specify true here if you want to use this media in Welcome Direct Messages.
            ...(additionalOwner && { additionalOwners: [additionalOwner] }),
            // maxConcurrentUploads: 3 //Number of concurrent chunk uploads allowed to be sent. Defaults to 3.
          }),
        );
      } catch (e) {
        throw this.user.error("Twitter.publishPost uploadMedia failed", e);
      }
    }

    const client2 = new TwitterApi(
      this.user.get("auth", "TWITTER_ACCESS_TOKEN"),
    );

    if (!dryrun) {
      this.user.trace("Tweeting " + post.id + "...");
      const result = await client2.v2.tweet({
        text: post.getCompiledBody(),
        media: { media_ids: mediaIds },
      });
      if (result.errors) {
        throw this.user.error(result.errors.join());
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
