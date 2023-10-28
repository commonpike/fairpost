import Logger from "../Logger";
import Platform from "../Platform";
import Facebook from "./Facebook";
import { PlatformId } from ".";
import Folder from "../Folder";
import Post from "../Post";
import { PostStatus } from "../Post";
import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

export default class Instagram extends Platform {
  id: PlatformId = PlatformId.INSTAGRAM;
  GRAPH_API_VERSION: string = "v18.0";

  constructor() {
    super();
  }

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
      Logger.error("Instagram.publishPost", this.id, "failed", response);
    } else if (!dryrun) {
      // post.link = ""; // todo : get instagram shortcode
      post.status = PostStatus.PUBLISHED;
      post.published = new Date();
    }

    post.save();
    return !error;
  }

  async test() {
    return this.get("me");
  }

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
      Logger.error("No id returned for container for " + file, container);
      throw new Error("No id returned for container for " + file);
    }

    if (!dryrun) {
      // wait for upload ?
      // https://github.com/fbsamples/reels_publishing_apis/blob/main/insta_reels_publishing_api_sample/utils.js#L23
      const response = (await this.postJson("%USER%/media_publish", {
        creation_id: container.id,
      })) as { id: string };
      if (!response?.id) {
        Logger.error("No id returned for igMedia for " + file, response);
        throw new Error("No id returned for igMedia for " + file);
      }
      return response;
    }

    return { id: "-99" };
  }

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
      Logger.error("No id returned for container for " + file, container);
      throw new Error("No id returned for container for " + file);
    }

    if (!dryrun) {
      // wait for upload ?
      // https://github.com/fbsamples/reels_publishing_apis/blob/main/insta_reels_publishing_api_sample/utils.js#L23
      const response = (await this.postJson("%USER%/media_publish", {
        creation_id: container.id,
      })) as { id: string };
      if (!response?.id) {
        Logger.error("No id returned for igMedia for " + file, response);
        throw new Error("No id returned for igMedia for " + file);
      }
      return response;
    }

    return { id: "-99" };
  }

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
      Logger.error("No id returned for carroussel container ", container);
      throw new Error("No id returned for carroussel container ");
    }

    // publish carousel
    if (!dryrun) {
      const response = (await this.postJson("%USER%/media_publish", {
        creation_id: container["id"],
      })) as {
        id: string;
      };
      if (!response["id"]) {
        Logger.error("No id returned for igMedia for carroussel", response);
        throw new Error("No id returned for igMedia for carroussel");
      }

      return response;
    }

    return { id: "-99" };
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
      throw new Error("No id returned after uploading photo " + file);
    }
    return result;
  }

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
      throw new Error("No derivates found for photo " + id);
    }

    // find largest derivative
    const largestPhoto = photoData.images?.reduce(function (prev, current) {
      return prev && prev.width > current.width ? prev : current;
    });
    if (!largestPhoto["source"]) {
      throw new Error("Largest derivate for photo " + id + " has no source");
    }
    return largestPhoto["source"];
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
      throw new Error("No id returned when uploading video");
    }
    return result;
  }

  private async fbGetVideoLink(id: string): Promise<string> {
    const videoData = (await this.get(id, {
      fields: "permalink_url,source",
    })) as {
      permalink_url: string;
      source: string;
    };
    if (!videoData.source) {
      throw new Error("No source url found for video " + id);
    }
    return videoData["source"];
  }

  /*
   * Return a long lived instagram page access token.
   *
   * UserAccessToken: a shortlived user access token
   */
  async getPageToken(userAccessToken: string): Promise<string> {
    if (!process.env.FAIRPOST_INSTAGRAM_APP_ID) {
      throw new Error("Set FAIRPOST_INSTAGRAM_APP_ID first");
    }
    if (!process.env.FAIRPOST_INSTAGRAM_APP_SECRET) {
      throw new Error("Set FAIRPOST_INSTAGRAM_APP_SECRET first");
    }
    if (!process.env.FAIRPOST_INSTAGRAM_PAGE_ID) {
      throw new Error("Set FAIRPOST_INSTAGRAM_PAGE_ID first");
    }
    const facebook = new Facebook();
    return await facebook.getLLPageToken(
      process.env.FAIRPOST_INSTAGRAM_APP_ID,
      process.env.FAIRPOST_INSTAGRAM_APP_SECRET,
      process.env.FAIRPOST_INSTAGRAM_PAGE_ID,
      userAccessToken,
    );
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
      process.env.FAIRPOST_INSTAGRAM_USER_ID,
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      process.env.FAIRPOST_INSTAGRAM_PAGE_ID,
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
      process.env.FAIRPOST_INSTAGRAM_USER_ID,
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      process.env.FAIRPOST_INSTAGRAM_PAGE_ID,
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
      process.env.FAIRPOST_INSTAGRAM_USER_ID,
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      process.env.FAIRPOST_INSTAGRAM_PAGE_ID,
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
      Logger.error("Ayrshare.handleApiResponse", response);
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
