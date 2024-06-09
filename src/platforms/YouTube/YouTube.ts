import * as fs from "fs";

import Folder, { FileGroup } from "../../models/Folder";

import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import User from "../../models/User";
import YouTubeAuth from "./YouTubeAuth";

export default class YouTube extends Platform {
  id: PlatformId = PlatformId.YOUTUBE;
  assetsFolder = "_youtube";
  postFileName = "post.json";

  auth: YouTubeAuth;

  // post defaults
  notifySubscribers = true;
  onBehalfOfContentOwner = "";
  onBehalfOfContentOwnerChannel = "";
  defaultLanguage = "en-us";
  embeddable = true;
  license = "youtube";
  publicStatsViewable = true;
  selfDeclaredMadeForKids = false;

  constructor(user: User) {
    super(user);
    this.auth = new YouTubeAuth(user);
  }

  /** @inheritdoc */
  async setup() {
    return await this.auth.setup();
  }

  /** @inheritdoc */
  async test() {
    return this.getChannel();
  }

  /** @inheritdoc */
  async refresh(): Promise<boolean> {
    await this.auth.refresh();
    return true;
  }

  /** @inheritdoc */
  async preparePost(folder: Folder): Promise<Post> {
    this.user.trace("YouTube.preparePost", folder.id);
    const post = await super.preparePost(folder);
    /*if (post) {
      // youtube: 1 video
      post.limitFiles("video", 1);
      post.removeFiles("image");
      post.removeFiles("text");
      post.removeFiles("other");
      if (!post.hasFiles("video")) {
        post.valid = false;
      }
      post.save();
    }*/
    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    this.user.trace("YouTube.publishPost", post.id, dryrun);

    let response = { id: "-99" } as {
      id?: string;
    };
    let error = undefined as Error | undefined;

    try {
      response = await this.publishVideoPost(post, dryrun);
    } catch (e) {
      error = e as Error;
    }

    return post.processResult(
      response.id as string,
      "https://www.youtube.com/watch?v=" + response.id,
      {
        date: new Date(),
        dryrun: dryrun,
        success: !error,
        error: error,
        response: response,
      },
    );
  }

  // Platform API Specific

  /**
   * GET part of the channel snippet
   * @returns object, incl. some ids and names
   */
  private async getChannel() {
    this.user.trace("YouTube", "getChannel");
    const client = this.auth.getClient();
    const result = (await client.channels.list({
      part: ["snippet", "contentDetails", "status"],
      mine: true,
    })) as {
      data?: {
        items?: {
          id: string;
          snippet: {
            title: string;
            customUrl: string;
          };
        }[];
      };
      status: number;
      statusText: string;
    };
    if (result.data?.items?.length) {
      return {
        id: result.data.items[0].id,
        snippet: {
          title: result.data.items[0].snippet.title,
          customUrl: result.data.items[0].snippet.customUrl,
        },
      };
    }
    throw this.user.error("YouTube.getChannel", "invalid result", result);
  }

  /**
   * POST title & body & video to the posts endpoint using json
   *
   * untested.
   * @param post
   * @param dryrun
   * @returns object, incl. id of the created post
   */
  private async publishVideoPost(post: Post, dryrun: boolean = false) {
    this.user.trace("YouTube.publishVideoPost", dryrun);

    const file = post.getFiles(FileGroup.VIDEO)[0];

    const client = this.auth.getClient();
    this.user.trace(
      "YouTube.publishVideoPost",
      "uploading " + file.name + " ...",
    );
    const result = (await client.videos.insert({
      part: ["snippet", "status"],
      notifySubscribers: this.notifySubscribers,
      ...(this.onBehalfOfContentOwner && {
        onBehalfOfContentOwner: this.onBehalfOfContentOwner,
      }),
      ...(this.onBehalfOfContentOwnerChannel && {
        onBehalfOfContentOwnerChannel: this.onBehalfOfContentOwnerChannel,
      }),
      requestBody: {
        snippet: {
          title: post.title,
          description: post.getCompiledBody("!title"),
          tags: post.tags, // both in body and separate
          categoryId: this.user.get("settings", "YOUTUBE_CATEGORY", ""),
          defaultLanguage: this.defaultLanguage,
        },
        status: {
          embeddable: this.embeddable,
          license: this.license,
          publicStatsViewable: this.publicStatsViewable,
          selfDeclaredMadeForKids: this.selfDeclaredMadeForKids,
          privacyStatus: this.user.get("settings", "YOUTUBE_PRIVACY"),
        },
      },
      media: {
        mimeType: file.mimetype,
        body: fs.createReadStream(post.getFilePath(file.name)),
      },
    })) as {
      data: {
        id: string;
        status?: {
          uploadStatus: string;
          failureReason: string;
          rejectionReason: string;
        };
        snippet: object;
      };
    };

    if (result.data.status?.uploadStatus !== "uploaded") {
      throw this.user.error(
        "YouTube.publishVideoPost",
        "failed",
        result.data.status?.uploadStatus,
        result.data.status?.failureReason,
        result.data.status?.rejectionReason,
      );
    }
    if (!result.data.id) {
      throw this.user.error(
        "YouTube.publishVideoPost",
        "missing id in result",
        result,
      );
    }

    return { id: result.data.id };
  }
}
