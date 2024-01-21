//import * as fs from "fs";
//import { handleApiError, handleEmptyResponse } from "../../utilities";

import Folder from "../../models/Folder";
import Logger from "../../services/Logger";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import YouTubeAuth from "./YouTubeAuth";

export default class YouTube extends Platform {
  id: PlatformId = PlatformId.YOUTUBE;
  assetsFolder = "_youtube";
  postFileName = "post.json";

  auth: YouTubeAuth;

  constructor() {
    super();
    this.auth = new YouTubeAuth();
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
    Logger.trace("YouTube.preparePost", folder.id);
    const post = await super.preparePost(folder);
    if (post) {
      // youtube: 1 video
      post.limitFiles("video", 1);
      post.removeFiles("image");
      post.removeFiles("text");
      post.removeFiles("other");
      if (!post.hasFiles("video")) {
        post.valid = false;
      }
      post.save();
    }
    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("YouTube.publishPost", post.id, dryrun);

    let response = { id: "-99" } as {
      id?: string;
      headers?: { [key: string]: string };
    };
    let error = undefined as Error | undefined;

    try {
      response = await this.publishVideoPost(post, dryrun);
    } catch (e) {
      error = e as Error;
    }

    return post.processResult(response.id as string, "#unknown", {
      date: new Date(),
      dryrun: dryrun,
      success: !error,
      error: error,
      response: response,
    });
  }

  // Platform API Specific

  /**
   * GET part of the channel snippet
   * @returns object, incl. some ids and names
   */
  private async getChannel() {
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
    throw Logger.error("YouTube.getChannel", "invalid result", result);
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
    Logger.trace("YouTube.publishVideoPost", dryrun);
    return { id: "-99" };
  }
}
