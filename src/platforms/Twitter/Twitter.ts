import { FileGroup, FieldMapping } from "../../types/index.ts";
import Source from "../../models/Source.ts";

import Platform from "../../models/Platform.ts";
import Post from "../../models/Post.ts";
import { TwitterApi } from "twitter-api-v2";
import TwitterAuth from "./TwitterAuth.ts";
import PlatformMapper from "../../mappers/PlatformMapper.ts";
import User from "../../models/User.ts";
import Operator from "../../models/Operator.ts";

/**
 * Twitter: support for twitter platform
 */

enum EUploadMimeType {
  Jpeg = "image/jpeg",
  Mp4 = "video/mp4",
  Mov = "video/quicktime",
  Gif = "image/gif",
  Png = "image/png",
  Srt = "text/plain",
  Webp = "image/webp",
}

export default class Twitter extends Platform {
  assetsFolder = "_twitter";
  postFileName = "post.json";
  pluginSettings = {
    limitfiles: {
      video_max: 0,
      image_max: 4,
    },
    imagesize: {
      max_width: 5000,
      max_size: 5000,
    },
  };
  settings: FieldMapping = {
    TWITTER_OA1_ADDITIONAL_OWNER: {
      type: "string",
      label: "Twitter additional owner (for OAuth1 file uploads)",
      get: ["managePlatforms"],
      set: ["managePlatforms"],
      required: true,
    },
    TWITTER_PLUGIN_SETTINGS: {
      type: "json",
      label: "Twitter Plugin settings",
      get: ["managePlatforms"],
      set: ["managePlatforms"],
      required: false,
      default: this.pluginSettings,
    },
  };
  auth: TwitterAuth;

  constructor(user: User) {
    super(user);
    this.auth = new TwitterAuth(user);
    this.mapper = new PlatformMapper(this);
  }

  /** @inheritdoc */
  async connect(operator: Operator, payload?: object) {
    if (operator.ui === "cli") {
      await this.auth.connectCli();
      return await this.test();
    }
    if (operator.ui === "api") {
      if (!payload) {
        throw this.user.log.error("Connect via api requires a payload");
      }
      return this.auth.connectApi(payload);
    }
    throw this.user.log.error(
      `${this.id} connect: ui ${operator.ui} not supported`,
    );
  }

  /** @inheritdoc */
  async test() {
    this.user.log.trace("Twitter.test: get oauth1 api");
    const client1 = new TwitterApi({
      appKey: this.user.data.get("app", "TWITTER_OA1_API_KEY"),
      appSecret: this.user.data.get("app", "TWITTER_OA1_API_KEY_SECRET"),
      accessToken: this.user.data.get("app", "TWITTER_OA1_ACCESS_TOKEN"),
      accessSecret: this.user.data.get("app", "TWITTER_OA1_ACCESS_SECRET"),
    });
    const creds1 = await client1.v1.verifyCredentials();
    this.user.log.trace("Twitter.test: get oauth2 api");
    const client2 = new TwitterApi(
      this.user.data.get("auth", "TWITTER_ACCESS_TOKEN"),
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
  async preparePost(source: Source): Promise<Post> {
    this.user.log.trace("Twitter.preparePost", source.id);
    const post = await this.getPost(source);
    await post.prepare();
    const userPluginSettings = JSON.parse(
      this.user.data.get("settings", "TWITTER_PLUGIN_SETTINGS", "{}"),
    );
    const pluginSettings = {
      ...this.pluginSettings,
      ...(userPluginSettings || {}),
    };
    const plugins = this.loadPlugins(pluginSettings);
    for (const plugin of plugins) {
      await plugin.process(post);
    }

    // remove files whose mime are not supported,
    // this could be a plugin
    for (const file of post.getFiles()) {
      if (
        !Object.values(EUploadMimeType).includes(
          file.mimetype as EUploadMimeType,
        )
      ) {
        this.user.log.trace("Removing unsupported file type: " + file.mimetype);
        post.removeFile(file.name);
      }
    }

    // limit the post body to 140 characters
    // this could be a plugin
    const charLimit = 140;
    if (post.body && post.body.length >= charLimit) {
      const splitBody = post.body.match(/[^.\n]+[.\n]*|[.\n]+/g);
      if (splitBody) {
        let newBody = "";
        let nextLine = splitBody.shift();
        while (nextLine && newBody.length + nextLine.length < charLimit) {
          newBody += nextLine;
          nextLine = splitBody.shift();
        }
        if (newBody !== "") {
          post.body = newBody;
        }
      }
      if (post.body.length >= charLimit) {
        post.body = post.body.substring(0, charLimit - 4) + "...";
      }
    }

    // twitter requires a real body or images
    if (!post.body && !post.hasFiles(FileGroup.IMAGE)) {
      this.user.log.warn("Twitter post has no body");
      post.valid = false;
    }
    await post.save();

    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    this.user.log.trace("Twitter.publishPost", post.id, dryrun);

    let response = { data: { id: "-99" } } as {
      data: {
        id: string;
      };
    };
    let error = undefined as Error | undefined;

    if (post.hasFiles(FileGroup.IMAGE)) {
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
    this.user.log.trace("Twitter.publishTextPost", post.id, dryrun);
    if (!dryrun) {
      const client2 = new TwitterApi(
        this.user.data.get("auth", "TWITTER_ACCESS_TOKEN"),
      );
      const result = await client2.v2.tweet({
        text: post.getCompiledBody(),
      });
      if (result.errors) {
        throw this.user.log.error(result.errors.join());
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
    this.user.log.trace("Twitter.publishImagesPost", post.id, dryrun);

    const client1 = new TwitterApi({
      appKey: this.user.data.get("app", "TWITTER_OA1_API_KEY"),
      appSecret: this.user.data.get("app", "TWITTER_OA1_API_KEY_SECRET"),
      accessToken: this.user.data.get("app", "TWITTER_OA1_ACCESS_TOKEN"),
      accessSecret: this.user.data.get("app", "TWITTER_OA1_ACCESS_SECRET"),
    });
    // eslint-disable-next-line
    const mediaIds = new Array() as
      | [string]
      | [string, string]
      | [string, string, string]
      | [string, string, string, string];

    const additionalOwner = this.user.data.get(
      "settings",
      "TWITTER_OA1_ADDITIONAL_OWNER",
      "",
    );
    for (const image of post.getFiles(FileGroup.IMAGE).splice(0, 4)) {
      const path = post.getFilePath(image.name);
      const buffer = await post.platform.user.files.readBuffer(path);
      this.user.log.trace("Uploading " + path + "...");
      try {
        mediaIds.push(
          await client1.v1.uploadMedia(buffer, {
            mimeType: image.mimetype,
            // mimeType : '' //MIME type as a string. To help you across allowed MIME types, enum EUploadMimeType is here for you. This option is required if file is not specified as string.
            // target: 'tweet' //Target type tweet or dm. Defaults to tweet. You must specify it if you send a media to use in DMs.
            // longVideo : false //Specify true here if you're sending a video and it can exceed 120 seconds. Otherwise, this option has no effet.
            // shared: false //Specify true here if you want to use this media in Welcome Direct Messages.
            ...(additionalOwner && { additionalOwners: [additionalOwner] }),
            // maxConcurrentUploads: 3 //Number of concurrent chunk uploads allowed to be sent. Defaults to 3.
          }),
        );
      } catch (e) {
        throw this.user.log.error("Twitter.publishPost uploadMedia failed", e);
      }
    }

    const client2 = new TwitterApi(
      this.user.data.get("auth", "TWITTER_ACCESS_TOKEN"),
    );

    if (!dryrun) {
      this.user.log.trace("Tweeting " + post.id + "...");
      const result = await client2.v2.tweet({
        text: post.getCompiledBody(),
        media: {
          media_ids: mediaIds,
        },
      });
      if (result.errors) {
        throw this.user.log.error(result.errors.join());
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
