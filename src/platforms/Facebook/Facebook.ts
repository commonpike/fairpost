import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

import FacebookApi from "./FacebookApi";
import FacebookAuth from "./FacebookAuth";
import Folder from "../../models/Folder";
import Logger from "../../services/Logger";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import Storage from "../../services/Storage";

/**
 * Facebook: support for facebook platform.
 *
 * Uses simple graph api calls to publish.
 * Adds fb specific tools to get a long lived page token,
 * also use by the instagram platform.
 */
export default class Facebook extends Platform {
  id: PlatformId = PlatformId.FACEBOOK;
  api: FacebookApi;
  auth: FacebookAuth;

  constructor() {
    super();
    this.auth = new FacebookAuth();
    this.api = new FacebookApi();
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
  async preparePost(folder: Folder): Promise<Post | undefined> {
    Logger.trace("Facebook.preparePost", folder.id);
    const post = await super.preparePost(folder);
    if (post && post.files) {
      // facebook: video post can only contain 1 video
      if (post.files.video.length) {
        post.files.video.length = 1;
        post.files.image = [];
      }
      // facebook : max 4mb images
      for (const src of post.files.image) {
        const dst = this.assetsFolder() + "/facebook-" + src;
        const size = fs.statSync(post.getFullPath(src)).size / (1024 * 1024);
        if (size >= 4) {
          Logger.trace("Resizing " + src + " for facebook ..");
          await sharp(post.getFullPath(src))
            .resize({
              width: 1200,
            })
            .toFile(post.getFullPath(dst));
          post.useAlternativeFile(src, dst);
        }
      }
      post.save();
    }
    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("Facebook.publishPost", post.id, dryrun);

    let response = { id: "-99" } as { id: string };
    let error = undefined;

    if (post.files.video.length) {
      try {
        response = await this.publishVideoPost(post, dryrun);
      } catch (e) {
        error = e;
      }
    } else if (post.files.image.length) {
      try {
        response = await this.publishImagesPost(post, dryrun);
      } catch (e) {
        error = e;
      }
    } else {
      try {
        response = await this.publishTextPost(post, dryrun);
      } catch (e) {
        error = e;
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
        message: post.body,
        published: Storage.get("settings", "FACEBOOK_PUBLISH_POSTS"),
      })) as { id: string };
    }
    return { id: "-99" };
  }

  /**
   * POST images to the page/feed endpoint using json
   * @param post - the post
   * @param dryrun - wether to really execure
   * @returns object, incl. id of the created post
   */
  private async publishImagesPost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{ id: string }> {
    const attachments = [];
    for (const image of post.files.image) {
      attachments.push({
        media_fbid: (await this.uploadImage(post.folder.path + "/" + image))[
          "id"
        ],
      });
    }

    if (!dryrun) {
      return (await this.api.postJson("%PAGE%/feed", {
        message: post.body,
        published: Storage.get("settings", "FACEBOOK_PUBLISH_POSTS"),
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
    const file = post.folder.path + "/" + post.files.video[0];
    const title = post.title;
    const description = post.body;

    Logger.trace("Reading file", file);
    const rawData = fs.readFileSync(file);
    const blob = new Blob([rawData]);

    const body = new FormData();
    body.set("title", title);
    body.set("description", description);
    body.set("published", Storage.get("settings", "FACEBOOK_PUBLISH_POSTS"));
    body.set("source", blob, path.basename(file));

    if (!dryrun) {
      const result = (await this.api.postForm("%PAGE%/videos", body)) as {
        id: string;
      };
      if (!result["id"]) {
        throw Logger.error("No id returned when uploading video");
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
    Logger.trace("Reading file", file);
    const rawData = fs.readFileSync(file);
    const blob = new Blob([rawData]);

    const body = new FormData();
    body.set("published", published ? "true" : "false");
    body.set("source", blob, path.basename(file));

    const result = (await this.api.postForm("%PAGE%/photos", body)) as {
      id: "string";
    };

    if (!result["id"]) {
      throw Logger.error("No id returned when uploading photo");
    }
    return result;
  }
}
