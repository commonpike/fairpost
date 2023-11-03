import Storage from "../core/Storage";
import Logger from "../core/Logger";
import Platform from "../core/Platform";
import { PlatformId } from ".";
import Folder from "../core/Folder";
import Post from "../core/Post";
import { PostStatus } from "../core/Post";
import FacebookAuth from "../auth/FacebookAuth";
import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

/**
 * Facebook: support for facebook platform.
 *
 * Uses simple graph api calls to publish.
 * Adds fb specific tools to get a long lived page token,
 * also use by the instagram platform.
 */
export default class Facebook extends Platform {
  id: PlatformId = PlatformId.FACEBOOK;
  GRAPH_API_VERSION: string = "v18.0";

  constructor() {
    super();
  }

  /** @inheritdoc */
  async setup() {
    const auth = new FacebookAuth();
    await auth.setup();
  }

  /** @inheritdoc */
  async test() {
    return this.get("me");
  }

  /** @inheritdoc */
  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post && post.files) {
      // facebook: video post can only contain 1 video
      if (post.files.video.length) {
        post.files.video.length = 1;
        post.files.image = [];
      }
      // facebook : max 4mb images
      for (const image of post.files.image) {
        const size =
          fs.statSync(post.folder.path + "/" + image).size / (1024 * 1024);
        if (size >= 4) {
          Logger.trace("Resizing " + image + " for facebook ..");
          await sharp(post.folder.path + "/" + image)
            .resize({
              width: 1200,
            })
            .toFile(post.folder.path + "/_facebook-" + image);
          post.files.image.push("_facebook-" + image);
          post.files.image = post.files.image.filter((file) => file !== image);
        }
      }
      post.save();
    }
    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("Facebook.publishPost", post, dryrun);

    let response = dryrun
      ? { id: "-99" }
      : ({} as { id?: string; error?: string });
    let error = undefined;

    if (post.files.video.length) {
      if (!dryrun) {
        try {
          response = await this.publishVideo(
            post.folder.path + "/" + post.files.video[0],
            post.title,
            post.body,
          );
        } catch (e) {
          error = e;
        }
      }
    } else {
      try {
        const attachments = [];
        if (post.files.image.length) {
          for (const image of post.files.image) {
            attachments.push({
              media_fbid: (
                await this.uploadPhoto(post.folder.path + "/" + image)
              )["id"],
            });
          }
        }
        if (!dryrun) {
          response = (await this.postJson("%PAGE%/feed", {
            message: post.body,
            published: Storage.get("settings", "FACEBOOK_PUBLISH_POSTS"),
            attached_media: attachments,
          })) as { id: string };
        }
      } catch (e) {
        error = e;
      }
    }

    post.results.push({
      date: new Date(),
      dryrun: dryrun,
      success: !error,
      error: error,
      response: response,
    });

    if (error) {
      Logger.error("Facebook.publishPost", this.id, "failed", response);
    }

    if (!dryrun) {
      if (!error) {
        (post.link = "https://facebook.com/" + response.id),
          (post.status = PostStatus.PUBLISHED);
        post.published = new Date();
      } else {
        post.status = PostStatus.FAILED;
      }
    }

    post.save();
    return !error;
  }

  /**
   * POST an image to the page/photos endpoint using multipart/form-data
   * @param file - path to the file to post
   * @param published - wether the photo should be published as a single facebook post
   * @returns id of the uploaded photo to use in post attachments
   */
  private async uploadPhoto(
    file: string = "",
    published = false,
  ): Promise<{ id: string }> {
    Logger.trace("Reading file", file);
    const rawData = fs.readFileSync(file);
    const blob = new Blob([rawData]);

    const body = new FormData();
    body.set("published", published ? "true" : "false");
    body.set("source", blob, path.basename(file));

    const result = (await this.postFormData("%PAGE%/photos", body)) as {
      id: "string";
    };

    if (!result["id"]) {
      throw new Error("No id returned when uploading photo");
    }
    return result;
  }

  /**
   * POST a video to the page/videos endpoint using multipart/form-data
   *
   * Videos will always become a single facebook post
   * when using the api.
   * Uses sync posting. may take a while or timeout.
   * @param file - path to the video to post
   * @param title - title of the post
   * @param description - body text of the post
   * @returns id of the uploaded video
   */
  private async publishVideo(
    file: string,
    title: string,
    description: string,
  ): Promise<{ id: string }> {
    Logger.trace("Reading file", file);
    const rawData = fs.readFileSync(file);
    const blob = new Blob([rawData]);

    const body = new FormData();
    body.set("title", title);
    body.set("description", description);
    body.set("published", Storage.get("settings", "FACEBOOK_PUBLISH_POSTS"));
    body.set("source", blob, path.basename(file));

    const result = (await this.postFormData("%PAGE%/videos", body)) as {
      id: string;
    };

    if (!result["id"]) {
      throw new Error("No id returned when uploading video");
    }
    return result;
  }

  // API implementation -------------------

  /**
   * Do a GET request on the graph.
   * @param endpoint - the path to call
   * @param query - query string as object
   */

  private async get(
    endpoint: string = "%PAGE%",
    query: { [key: string]: string } = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%PAGE%",
      Storage.get("settings", "FACEBOOK_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();
    Logger.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization:
          "Bearer " + Storage.get("auth", "FACEBOOK_PAGE_ACCESS_TOKEN"),
      },
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Do a Json POST request on the graph.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  private async postJson(
    endpoint: string = "%PAGE%",
    body = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%PAGE%",
      Storage.get("settings", "FACEBOOK_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    Logger.trace("POST", url.href);
    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization:
          "Bearer " + Storage.get("settings", "FACEBOOK_PAGE_ACCESS_TOKEN"),
      },
      body: JSON.stringify(body),
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Do a FormData POST request on the graph.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  private async postFormData(
    endpoint: string,
    body: FormData,
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%PAGE%",
      Storage.get("settings", "FACEBOOK_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    Logger.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization:
          "Bearer " + Storage.get("settings", "FACEBOOK_PAGE_ACCESS_TOKEN"),
      },
      body: body,
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Handle api response
   * @param response - api response from fetch
   * @returns parsed object from response
   */
  private async handleApiResponse(response: Response): Promise<object> {
    if (!response.ok) {
      Logger.error("Facebook.handleApiResponse", response);
      throw new Error(response.status + ":" + response.statusText);
    }
    const data = await response.json();
    if (data.error) {
      const error =
        response.status +
        ":" +
        data.error.type +
        "(" +
        data.error.code +
        "/" +
        data.error.error_subcode +
        ") " +
        data.error.message;
      Logger.error("Facebook.handleApiResponse", error);
      throw new Error(error);
    }
    Logger.trace("Facebook.handleApiResponse", "success");
    return data;
  }

  /**
   * Handle api error
   * @param error - the error returned from fetch
   */
  private handleApiError(error: Error): never {
    Logger.error("Facebook.handleApiError", error);
    throw error;
  }
}
