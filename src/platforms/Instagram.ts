import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

import Folder from "../models/Folder";
import InstagramAuth from "../auth/InstagramAuth";
import Logger from "../services/Logger";
import Platform from "../models/Platform";
import { PlatformId } from ".";
import Post from "../models/Post";
import { PostStatus } from "../models/Post";
import Storage from "../services/Storage";

/**
 * Instagram: support for instagram platform.
 *
 * Uses simple graph api calls to publish.
 * Uses fb specific tools to get a long lived page token,
 * also uses facebook calls to upload files
 */
export default class Instagram extends Platform {
  id: PlatformId = PlatformId.INSTAGRAM;
  GRAPH_API_VERSION: string = "v18.0";

  constructor() {
    super();
  }

  /** @inheritdoc */
  async setup() {
    const auth = new InstagramAuth();
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
      // instagram: 1 video for reel
      if (post.files.video.length) {
        if (post.files.video.length > 10) {
          Logger.trace("Removing > 10 videos for instagram caroussel..");
          post.files.video.length = 10;
        }
        const remaining = 10 - post.files.video.length;
        if (post.files.image.length > remaining) {
          Logger.trace("Removing some images for instagram caroussel..");
          post.files.image.length = remaining;
        }
      }

      // instagram : scale images, jpeg only
      for (const image of post.files.image) {
        const metadata = await sharp(post.folder.path + "/" + image).metadata();
        if (metadata.width > 1440) {
          Logger.trace("Resizing " + image + " for instagram ..");
          const extension = image.split(".")?.pop();
          const basename = path.basename(
            image,
            extension ? "." + extension : "",
          );
          const outfile = "_instagram-" + basename + ".JPEG";
          await sharp(post.folder.path + "/" + image)
            .resize({
              width: 1440,
            })
            .toFile(post.folder.path + "/" + outfile);
          post.files.image.push(outfile);
          post.files.image = post.files.image.filter((file) => file !== image);
        }
      }

      // instagram: require media
      if (post.files.image.length + post.files.video.length === 0) {
        post.valid = false;
      }
      post.save();
    }
    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("Instagram.publishPost", post, dryrun);

    let response = dryrun ? { id: "-99" } : ({} as { id: string });
    let error = undefined;

    try {
      if (post.files.video.length === 1 && !post.files.image.length) {
        response = await this.publishVideo(
          post.files.video[0],
          post.body,
          dryrun,
        );
      } else if (post.files.image.length === 1 && !post.files.video.length) {
        response = await this.publishPhoto(
          post.files.image[0],
          post.body,
          dryrun,
        );
      } else {
        response = await this.publishCaroussel(post, dryrun);
      }
    } catch (e) {
      error = e;
    }

    post.results.push({
      date: new Date(),
      dryrun: dryrun,
      success: !error,
      error: error,
      response: response,
    });

    if (error) {
      Logger.warn("Instagram.publishPost", this.id, "failed", response);
    } else if (!dryrun) {
      // post.link = ""; // todo : get instagram shortcode
      post.status = PostStatus.PUBLISHED;
      post.published = new Date();
    }

    post.save();
    return !error;
  }

  /**
   * Publish a single photo
   *
   * Upload a photo to facebook, use the largest derivate
   * to put in a single container and publish that
   * @param file - path to the photo to post
   * @param caption - text body of the post
   * @param dryrun - wether to actually post it
   * @returns id of the published container
   */
  private async publishPhoto(
    file,
    caption: string = "",
    dryrun: boolean = false,
  ): Promise<{ id: string }> {
    const photoId = (await this.fbUploadPhoto(file))["id"];
    const photoLink = await this.fbGetPhotoLink(photoId);
    const container = (await this.postJson("%USER%/media", {
      image_url: photoLink,
      caption: caption,
    })) as { id: string };
    if (!container?.id) {
      throw Logger.error("No id returned for container for " + file, container);
    }

    if (!dryrun) {
      // wait for upload ?
      // https://github.com/fbsamples/reels_publishing_apis/blob/main/insta_reels_publishing_api_sample/utils.js#L23
      const response = (await this.postJson("%USER%/media_publish", {
        creation_id: container.id,
      })) as { id: string };
      if (!response?.id) {
        throw Logger.error("No id returned for igMedia for " + file, response);
      }
      return response;
    }

    return { id: "-99" };
  }

  /**
   * Publish a single video
   *
   * Upload a video to facebook, use the  derivate
   * to put in a single container and publish that
   * @param file - path to the photo to post
   * @param caption - text body of the post
   * @param dryrun - wether to actually post it
   * @returns id of the published container
   */
  private async publishVideo(
    file,
    caption: string = "",
    dryrun: boolean = false,
  ): Promise<{ id: string }> {
    const videoId = (await this.fbUploadVideo(file))["id"];
    const videoLink = await this.fbGetVideoLink(videoId);
    const container = (await this.postJson("%USER%/media", {
      video_url: videoLink,
      caption: caption,
    })) as { id: string };
    if (!container?.id) {
      throw Logger.error("No id returned for container for " + file, container);
    }

    if (!dryrun) {
      // wait for upload ?
      // https://github.com/fbsamples/reels_publishing_apis/blob/main/insta_reels_publishing_api_sample/utils.js#L23
      const response = (await this.postJson("%USER%/media_publish", {
        creation_id: container.id,
      })) as { id: string };
      if (!response?.id) {
        throw Logger.error("No id returned for igMedia for " + file, response);
      }
      return response;
    }

    return { id: "-99" };
  }

  /**
   * Publish a caroussel
   *
   * Upload a videos and photos to facebook, use the derivates
   * to put in a single container and publish that
   * @param post - the post to publish
   * @param dryrun - wether to actually post it
   * @returns id of the published container
   */
  private async publishCaroussel(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{ id: string }> {
    const uploadIds = [] as string[];

    for (const video of post.files.video) {
      const videoId = (
        await this.fbUploadVideo(post.folder.path + "/" + video)
      )["id"];
      const videoLink = await this.fbGetVideoLink(videoId);
      uploadIds.push(
        (
          await this.postJson("%USER%/media", {
            is_carousel_item: true,
            video_url: videoLink,
          })
        )["id"],
      );
    }

    for (const image of post.files.image) {
      const photoId = (
        await this.fbUploadPhoto(post.folder.path + "/" + image)
      )["id"];
      const photoLink = await this.fbGetPhotoLink(photoId);
      uploadIds.push(
        (
          await this.postJson("%USER%/media", {
            is_carousel_item: true,
            image_url: photoLink,
          })
        )["id"],
      );
    }

    // create carousel
    const container = (await this.postJson("%USER%/media", {
      media_type: "CAROUSEL",
      caption: post.body,
      children: uploadIds.join(","),
    })) as {
      id: string;
    };
    if (!container["id"]) {
      throw Logger.error("No id returned for carroussel container ", container);
    }

    // publish carousel
    if (!dryrun) {
      const response = (await this.postJson("%USER%/media_publish", {
        creation_id: container["id"],
      })) as {
        id: string;
      };
      if (!response["id"]) {
        throw Logger.error(
          "No id returned for igMedia for carroussel",
          response,
        );
      }

      return response;
    }

    return { id: "-99" };
  }

  /**
   * POST an image to the facebook page/photos endpoint
   * @param file - path to the file to post
   * @returns id of the uploaded photo to use in post attachments
   */
  private async fbUploadPhoto(file: string = ""): Promise<{ id: string }> {
    Logger.trace("Reading file", file);
    const rawData = fs.readFileSync(file);
    const blob = new Blob([rawData]);

    const body = new FormData();
    body.set("published", "false");
    body.set("source", blob, path.basename(file));

    const result = (await this.postFormData("%PAGE%/photos", body)) as {
      id: "string";
    };

    if (!result["id"]) {
      throw Logger.error("No id returned after uploading photo " + file);
    }
    return result;
  }

  /**
   * Get a link to an uploaded facebook photo
   * @param id - id of the uploaded photo
   * @returns link to the largest derivate of that photo to use in post attachments
   */
  private async fbGetPhotoLink(id: string): Promise<string> {
    // get photo derivatives
    const photoData = (await this.get(id, {
      fields: "link,images,picture",
    })) as {
      link: string;
      images: {
        width: number;
        height: number;
        source: string;
      }[];
      picture: string;
    };
    if (!photoData.images?.length) {
      throw Logger.error("No derivates found for photo " + id);
    }

    // find largest derivative
    const largestPhoto = photoData.images?.reduce(function (prev, current) {
      return prev && prev.width > current.width ? prev : current;
    });
    if (!largestPhoto["source"]) {
      throw Logger.error("Largest derivate for photo " + id + " has no source");
    }
    return largestPhoto["source"];
  }

  /**
   * POST an video to the facebook page/videos endpoint
   * @param file - path to the file to post
   * @returns id of the uploaded video to use in post attachments
   */

  private async fbUploadVideo(file: string): Promise<{ id: string }> {
    Logger.trace("Reading file", file);
    const rawData = fs.readFileSync(file);
    const blob = new Blob([rawData]);

    const body = new FormData();
    body.set("title", "Fairpost temp instagram upload");
    body.set("published", "false");
    body.set("source", blob, path.basename(file));

    const result = (await this.postFormData("%PAGE%/videos", body)) as {
      id: string;
    };

    if (!result["id"]) {
      throw Logger.error("No id returned when uploading video");
    }
    return result;
  }

  /**
   * Get a link to an uploaded facebook video
   * @param id - id of the uploaded video
   * @returns link to the video to use in post attachments
   */

  private async fbGetVideoLink(id: string): Promise<string> {
    const videoData = (await this.get(id, {
      fields: "permalink_url,source",
    })) as {
      permalink_url: string;
      source: string;
    };
    if (!videoData.source) {
      throw Logger.error("No source url found for video " + id);
    }
    return videoData["source"];
  }

  // API implementation -------------------

  /**
   * Do a GET request on the graph.
   * @param endpoint - the path to call
   * @param query - querystring as object
   * @returns parsed response
   */

  private async get(
    endpoint: string = "%USER%",
    query: { [key: string]: string } = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      Storage.get("settings", "INSTAGRAM_USER_ID"),
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      Storage.get("settings", "INSTAGRAM_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();
    const accessToken = Storage.get("auth", "INSTAGRAM_PAGE_ACCESS_TOKEN");
    Logger.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: accessToken
        ? {
            Accept: "application/json",
            Authorization: "Bearer " + accessToken,
          }
        : {
            Accept: "application/json",
          },
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Do a Json POST request on the graph.
   * @param endpoin - the path to call
   * @param body - body as object
   * @returns the parsed response as object
   */

  private async postJson(
    endpoint: string = "%USER%",
    body = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      Storage.get("settings", "INSTAGRAM_USER_ID"),
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      Storage.get("settings", "INSTAGRAM_PAGE_ID"),
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
          "Bearer " + Storage.get("auth", "INSTAGRAM_PAGE_ACCESS_TOKEN"),
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
   * @returns the parsed response as object
   */

  private async postFormData(
    endpoint: string,
    body: FormData,
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      Storage.get("settings", "INSTAGRAM_USER_ID"),
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      Storage.get("settings", "INSTAGRAM_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    Logger.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization:
          "Bearer " + Storage.get("settings", "INSTAGRAM_PAGE_ACCESS_TOKEN"),
      },
      body: body,
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Handle api response
   * @param response - the api response from fetch
   * @returns the parsed response
   */
  private async handleApiResponse(response: Response): Promise<object> {
    if (!response.ok) {
      throw Logger.error("Ayrshare.handleApiResponse", response);
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
      throw Logger.error("Facebook.handleApiResponse", error);
    }
    Logger.trace("Facebook.handleApiResponse", "success");
    return data;
  }

  /**
   * Handle api error
   * @param error - the api error returned from fetch
   */
  private handleApiError(error: Error): never {
    throw Logger.error("Facebook.handleApiError", error);
  }
}
