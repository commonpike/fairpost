import * as fs from "fs";
import * as path from "path";

import Folder, { FileGroup } from "../../models/Folder";

import FacebookApi from "./FacebookApi";
import FacebookAuth from "./FacebookAuth";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import User from "../../models/User";

/**
 * Facebook: support for facebook platform.
 *
 * Uses simple graph api calls to publish.
 * Adds fb specific tools to get a long lived page token,
 * also use by the instagram platform.
 */
export default class Facebook extends Platform {
  id: PlatformId = PlatformId.FACEBOOK;
  assetsFolder = "_facebook";
  postFileName = "post.json";
  pluginSettings = {
    limitfiles: {
      exclusive: ["video"],
      video_max: 1,
    },
    imagesize: {
      max_size: 4000,
    },
  };

  api: FacebookApi;
  auth: FacebookAuth;

  constructor(user: User) {
    super(user);
    this.auth = new FacebookAuth(user);
    this.api = new FacebookApi(user);
  }

  /** @inheritdoc */
  async setup() {
    await this.auth.setup();
  }

  /** @inheritdoc */
  async test() {
    return this.api.get("me");
  }

  /** @inheritdoc */
  async preparePost(folder: Folder): Promise<Post> {
    this.user.trace("Facebook.preparePost", folder.id);
    const post = await super.preparePost(folder);
    if (post && post.files) {
      const userPluginSettings = JSON.parse(
        this.user.get("settings", "FACEBOOK_PLUGIN_SETTINGS", "{}"),
      );
      const pluginSettings = {
        ...this.pluginSettings,
        ...(userPluginSettings || {}),
      };
      const plugins = this.loadPlugins(pluginSettings);
      for (const plugin of plugins) {
        await plugin.process(post);
      }
      post.save();
    }
    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    this.user.trace("Facebook.publishPost", post.id, dryrun);

    let response = { id: "-99" } as { id: string };
    let error = undefined as Error | undefined;

    if (post.hasFiles(FileGroup.VIDEO)) {
      try {
        response = await this.publishVideoPost(post, dryrun);
      } catch (e) {
        error = e as Error;
      }
    } else if (post.hasFiles(FileGroup.IMAGE)) {
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
      response.id,
      "https://facebook.com/" + response.id,
      {
        date: new Date(),
        dryrun: dryrun,
        success: !error,
        response: response,
        error: error,
      },
    );
  }

  /**
   * POST body to the page/feed endpoint using json
   * @param post - the post
   * @param dryrun - wether to really execure
   * @returns object, incl. id of the created post
   */
  private async publishTextPost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{ id: string }> {
    if (!dryrun) {
      return (await this.api.postJson("%PAGE%/feed", {
        message: post.getCompiledBody(),
        published: this.user.get("settings", "FACEBOOK_PUBLISH_POSTS"),
      })) as { id: string };
    }
    return { id: "-99" };
  }

  /**
   * POST images to the page/feed endpoint using json
   * @param post - the post
   * @param dryrun - wether to really execute
   * @returns object, incl. id of the created post
   */
  private async publishImagesPost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{ id: string }> {
    const attachments = [];
    for (const image of post.getFiles(FileGroup.IMAGE)) {
      attachments.push({
        media_fbid: (await this.uploadImage(post.getFilePath(image.name)))[
          "id"
        ],
      });
    }

    if (!dryrun) {
      return (await this.api.postJson("%PAGE%/feed", {
        message: post.getCompiledBody(),
        published: this.user.get("settings", "FACEBOOK_PUBLISH_POSTS"),
        attached_media: attachments,
      })) as { id: string };
    }
    return { id: "-99" };
  }

  /**
   * POST a video to the page/videos endpoint using multipart/form-data
   *
   * Videos will always become a single facebook post
   * when using the api.
   * Uses sync posting. may take a while or timeout.
   * @param post - the post
   * @param dryrun - wether to really execure
   * @returns object, incl. id of the uploaded video
   */
  private async publishVideoPost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{ id: string }> {
    const file = post.getFilePath(post.getFiles(FileGroup.VIDEO)[0].name);
    const title = post.title;
    const description = post.getCompiledBody("!title");

    this.user.trace("Reading file", file);
    const rawData = fs.readFileSync(file);
    const blob = new Blob([rawData]);

    const body = new FormData();
    body.set("title", title);
    body.set("description", description);
    body.set("published", this.user.get("settings", "FACEBOOK_PUBLISH_POSTS"));
    body.set("source", blob, path.basename(file));

    if (!dryrun) {
      const result = (await this.api.postForm("%PAGE%/videos", body)) as {
        id: string;
      };
      if (!result["id"]) {
        throw this.user.error("No id returned when uploading video");
      }
      return result;
    }
    return { id: "-99" };
  }

  /**
   * POST an image to the page/photos endpoint using multipart/form-data
   * @param file - path to the file to post
   * @param published - wether the photo should be published as a single facebook post
   * @returns id of the uploaded photo to use in post attachments
   */
  private async uploadImage(
    file: string = "",
    published = false,
  ): Promise<{ id: string }> {
    this.user.trace("Reading file", file);
    const rawData = fs.readFileSync(file);
    const blob = new Blob([rawData]);

    const body = new FormData();
    body.set("published", published ? "true" : "false");
    body.set("source", blob, path.basename(file));

    const result = (await this.api.postForm("%PAGE%/photos", body)) as {
      id: "string";
    };

    if (!result["id"]) {
      throw this.user.error("No id returned when uploading photo");
    }
    return result;
  }
}
