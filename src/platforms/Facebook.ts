import Logger from "../Logger";
import Platform from "../Platform";
import { PlatformId } from ".";
import Folder from "../Folder";
import Post from "../Post";
import { PostStatus } from "../Post";
import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

export default class Facebook extends Platform {
  id: PlatformId = PlatformId.FACEBOOK;
  GRAPH_API_VERSION: string = "v18.0";

  constructor() {
    super();
  }

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
            published: process.env.FAIRPOST_FACEBOOK_PUBLISH_POSTS,
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

  async test() {
    return this.get();
  }

  /*
   * POST an image to the page/photos endpoint using multipart/form-data
   *
   * arguments:
   * file: path to the file to post
   *
   * returns:
   * id of the uploaded photo to use in post attachments
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

  /*
   * POST a video to the page/videos endpoint using multipart/form-data
   *
   * arguments:
   * file: path to the video to post
   * published: wether to publish it or not
   *
   * returns:
   * { id: string }
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
    body.set("published", process.env.FAIRPOST_FACEBOOK_PUBLISH_POSTS);
    body.set("source", blob, path.basename(file));

    const result = (await this.postFormData("%PAGE%/videos", body)) as {
      id: string;
    };

    if (!result["id"]) {
      throw new Error("No id returned when uploading video");
    }
    return result;
  }

  /*
   * Return a long lived page access token.
   *
   * appUserId: a app-scoped-user-id
   * UserAccessToken: a shortlived user access token
   */
  async getPageToken(
    appUserId: string,
    userAccessToken: string,
  ): Promise<string> {
    // 1. Get a long lived UserAccessToken
    const query1 = {
      grant_type: "fb_exchange_token",
      client_id: process.env.FAIRPOST_FACEBOOK_APP_ID,
      client_secret: process.env.FAIRPOST_FACEBOOK_APP_SECRET,
      fb_exchange_token: userAccessToken,
    };
    const data1 = (await this.get("oauth/access_token", query1)) as {
      access_token: string;
    };
    const llUserAccessToken = data1["access_token"];
    if (!llUserAccessToken) {
      console.error(data1);
      throw new Error("No llUserAccessToken access_token in response.");
    }

    // 2. Get a long lived PageAccessToken
    const query2 = {
      access_token: llUserAccessToken,
    };
    const data2 = (await this.get(appUserId + "/accounts", query2)) as {
      data: {
        id: string;
        access_token: string;
      }[];
    };
    const llPageAccessToken = data2.data?.find(
      (page) => page.id === process.env.FAIRPOST_FACEBOOK_PAGE_ID,
    )["access_token"];

    if (!llPageAccessToken) {
      console.error(data2);
      throw new Error(
        "No llPageAccessToken for page " +
          process.env.FAIRPOST_FACEBOOK_PAGE_ID +
          "  in response.",
      );
    }

    return llPageAccessToken;
  }

  // API implementation -------------------

  /*
   * Do a GET request on the graph.
   *
   * arguments:
   * endpoint: the path to call
   * query: query string as object
   */

  private async get(
    endpoint: string = "%USER%",
    query: { [key: string]: string } = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      process.env.FAIRPOST_FACEBOOK_USER_ID,
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      process.env.FAIRPOST_FACEBOOK_PAGE_ID,
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();
    Logger.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: process.env.FAIRPOST_INSTAGRAM_PAGE_ACCESS_TOKEN
        ? {
            Accept: "application/json",
            Authorization:
              "Bearer " + process.env.FAIRPOST_INSTAGRAM_PAGE_ACCESS_TOKEN,
          }
        : {
            Accept: "application/json",
          },
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /*
   * Do a Json POST request on the graph.
   *
   * arguments:
   * endpoint: the path to call
   * body: body as object
   */

  private async postJson(
    endpoint: string = "%USER%",
    body = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      process.env.FAIRPOST_FACEBOOK_USER_ID,
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      process.env.FAIRPOST_FACEBOOK_PAGE_ID,
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
          "Bearer " + process.env.FAIRPOST_INSTAGRAM_PAGE_ACCESS_TOKEN,
      },
      body: JSON.stringify(body),
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /*
   * Do a FormData POST request on the graph.
   *
   * arguments:
   * endpoint: the path to call
   * body: body as object
   */

  private async postFormData(
    endpoint: string,
    body: FormData,
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      process.env.FAIRPOST_FACEBOOK_USER_ID,
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      process.env.FAIRPOST_FACEBOOK_PAGE_ID,
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    Logger.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization:
          "Bearer " + process.env.FAIRPOST_INSTAGRAM_PAGE_ACCESS_TOKEN,
      },
      body: body,
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /*
   * Handle api response
   *
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

  /*
   * Handle api error
   *
   */
  private handleApiError(error: Error): Promise<object> {
    Logger.error("Facebook.handleApiError", error);
    throw error;
  }
}
