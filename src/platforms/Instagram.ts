import Logger from "../Logger";
import Platform from "../Platform";
import { PlatformId } from ".";
import Folder from "../Folder";
import Post from "../Post";
//import { PostStatus } from "../Post";
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
        Logger.trace("Removing images for instagram reel..");
        post.files.image = [];
        if (post.files.video.length > 1) {
          Logger.trace("Using first video for instagram reel..");
          post.files.video = [post.files.video[0]];
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
          await sharp(post.folder.path + "/" + image)
            .resize({
              width: 1440,
            })
            .toFile(post.folder.path + "/_instagram-" + basename + ".JPEG");
          post.files.image.push("_instagram-" + image);
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
    console.log("Instagram.publishPost", post, dryrun);
    throw new Error("not implemented");
  }

  async test() {
    return this.testUploadCarousel();
  }

  async testUploadCarousel() {
    // upload photo to facebook
    const photoId = (
      await this.uploadPhoto("/Users/pike/Desktop/test/test.jpg", false)
    )["id"];
    if (!photoId) return;

    // get photo link
    const photoData = (await this.get(photoId, {
      fields: "link,images,picture",
    })) as {
      images: {
        width: number;
        height: number;
        source: string;
      }[];
    };
    if (!photoData) return;

    const maxPhoto = photoData.images?.reduce(function (prev, current) {
      return prev && prev.width > current.width ? prev : current;
    });
    if (!maxPhoto) return;

    const photoLink = maxPhoto["source"];

    // upload link to instagram
    const uploadId = (
      await this.postJson("%USER%/media", {
        is_carousel_item: true,
        image_url: photoLink,
      })
    )["id"];
    if (!uploadId) return;

    // create carousel
    const carouselId = (
      await this.postJson("%USER%/media", {
        media_type: "CAROUSEL",
        caption: "test",
        children: [uploadId, uploadId].join(","),
      })
    )["id"];
    if (!carouselId) return;

    // publish carousel
    const igMediaId = (
      await this.postJson("%USER%/media_publish", {
        creation_id: carouselId,
      })
    )["id"];
    if (!igMediaId) return;

    return igMediaId;
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
