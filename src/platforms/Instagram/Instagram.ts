import * as fs from "fs";
import * as path from "path";

import Folder from "../../models/Folder";
import InstagramApi from "./InstagramApi";
import InstagramAuth from "./InstagramAuth";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import User from "../../models/User";
import sharp from "sharp";

/**
 * Instagram: support for instagram platform.
 *
 * Uses simple graph api calls to publish.
 * Uses fb specific tools to get a long lived page token,
 * also uses facebook calls to upload files
 */
export default class Instagram extends Platform {
  id: PlatformId = PlatformId.INSTAGRAM;
  assetsFolder = "_instagram";
  postFileName = "post.json";

  api: InstagramApi;
  auth: InstagramAuth;

  pollingDelay = 2500;
  pollingLimit = 20;

  constructor(user: User) {
    super(user);
    this.auth = new InstagramAuth(user);
    this.api = new InstagramApi(user);
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
    this.user.trace("Instagram.preparePost", folder.id);
    const post = await super.preparePost(folder);
    if (post && post.files) {
      // instagram: 1 video for reel
      const numVideos = post.getFiles("video").length;
      if (numVideos) {
        if (numVideos > 10) {
          this.user.trace("Removing > 10 videos for instagram caroussel..");
          post.limitFiles("video", 10);
        }
        const remaining = 10 - post.getFiles("video").length;
        if (post.getFiles("image").length > remaining) {
          this.user.trace("Removing some images for instagram caroussel..");
          post.limitFiles("images", remaining);
        }
      }

      // instagram : scale images, jpeg only
      for (const file of post.getFiles("image")) {
        if (file.width && file.width > 1440) {
          const src = file.name;
          const dst =
            this.assetsFolder + "/instagram-" + file.basename + ".JPEG";
          this.user.trace("Resizing " + src + " for instagram ..");
          await sharp(post.getFilePath(src))
            .resize({
              width: 1440,
            })
            .toFile(post.getFilePath(dst));
          await post.replaceFile(src, dst);
        }
      }

      // instagram: require media
      if (post.getFiles("image").length + post.getFiles("video").length === 0) {
        post.valid = false;
      }
      post.save();
    }
    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    this.user.trace("Instagram.publishPost", post.id, dryrun);

    let response = { id: "-99" } as { id: string; permalink?: string };
    let error = undefined as Error | undefined;

    if (post.getFiles("video").length === 1 && !post.hasFiles("image")) {
      try {
        response = await this.publishVideoPost(post, dryrun);
      } catch (e) {
        error = e as Error;
      }
    } else if (post.getFiles("image").length === 1 && !post.hasFiles("video")) {
      try {
        response = await this.publishImagePost(post, dryrun);
      } catch (e) {
        error = e as Error;
      }
    } else {
      try {
        response = await this.publishMixedPost(post, dryrun);
      } catch (e) {
        error = e as Error;
      }
    }

    const details = await this.api.get(response.id, {
      fields: "id,media_type,permalink,thumbnail_url,timestamp,username",
    });
    response = { ...response, ...details };

    return post.processResult(response.id, response.permalink ?? "#unknown", {
      date: new Date(),
      dryrun: dryrun,
      success: !error,
      error: error,
      response: response,
    });
  }

  /**
   * Publish a single photo
   *
   * Upload a photo to facebook, use the largest derivate
   * to put in a single container and publish that
   * @param post - the post
   * @param dryrun - wether to actually post it
   * @returns id of the published container
   */
  private async publishImagePost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{ id: string }> {
    const file = post.getFilePath(post.getFiles("image")[0].name);
    const caption = post.getCompiledBody();
    const photoId = (await this.uploadImage(file))["id"];
    const photoLink = await this.getImageLink(photoId);
    const container = (await this.api.postJson("%USER%/media", {
      image_url: photoLink,
      caption: caption,
    })) as { id: string };
    if (!container?.id) {
      throw this.user.error(
        "No id returned for container for " + file,
        container,
      );
    }

    // wait for ready
    try {
      await this.checkPostStatus(container.id);
    } catch (e) {
      throw this.user.error(e);
    }

    if (!dryrun) {
      const response = (await this.api.postJson("%USER%/media_publish", {
        creation_id: container.id,
      })) as { id: string };
      if (!response?.id) {
        throw this.user.error(
          "No id returned for igMedia for " + file,
          response,
        );
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
   * @param post
   * @param dryrun - wether to actually post it
   * @returns id of the published container
   */
  private async publishVideoPost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{ id: string }> {
    const file = post.getFilePath(post.getFiles("video")[0].name);
    const caption = post.getCompiledBody();
    const videoId = (await this.uploadVideo(file))["id"];
    const videoLink = await this.getVideoLink(videoId);
    const container = (await this.api.postJson("%USER%/media", {
      media_type: "REELS",
      video_url: videoLink,
      caption: caption,
    })) as { id: string };
    if (!container?.id) {
      throw this.user.error(
        "No id returned for container for " + file,
        container,
      );
    }

    // wait for ready
    try {
      await this.checkPostStatus(container.id);
    } catch (e) {
      throw this.user.error(e);
    }

    if (!dryrun) {
      const response = (await this.api.postJson("%USER%/media_publish", {
        creation_id: container.id,
      })) as { id: string };
      if (!response?.id) {
        throw this.user.error(
          "No id returned for igMedia for " + file,
          response,
        );
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
  private async publishMixedPost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{ id: string }> {
    const uploadIds = [] as string[];

    for (const file of post.getFiles("video", "image")) {
      if (file.group === "video") {
        const videoId = (await this.uploadVideo(post.getFilePath(file.name)))[
          "id"
        ];
        const videoLink = await this.getVideoLink(videoId);
        uploadIds.push(
          (
            (await this.api.postJson("%USER%/media", {
              media_type: "REELS",
              is_carousel_item: true,
              video_url: videoLink,
            })) as { id: string }
          )["id"],
        );
      }
      if (file.group === "image") {
        const photoId = (await this.uploadImage(post.getFilePath(file.name)))[
          "id"
        ];
        const photoLink = await this.getImageLink(photoId);
        uploadIds.push(
          (
            (await this.api.postJson("%USER%/media", {
              is_carousel_item: true,
              image_url: photoLink,
            })) as { id: string }
          )["id"],
        );
      }
    }

    // create carousel
    const container = (await this.api.postJson("%USER%/media", {
      media_type: "CAROUSEL",
      caption: post.getCompiledBody(),
      children: uploadIds.join(","),
    })) as {
      id: string;
    };
    if (!container["id"]) {
      throw this.user.error(
        "No id returned for carroussel container ",
        container,
      );
    }

    // wait for ready
    try {
      await this.checkPostStatus(container.id);
    } catch (e) {
      throw this.user.error(e);
    }

    // publish carousel
    if (!dryrun) {
      const response = (await this.api.postJson("%USER%/media_publish", {
        creation_id: container["id"],
      })) as {
        id: string;
      };
      if (!response["id"]) {
        throw this.user.error(
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
  private async uploadImage(file: string = ""): Promise<{ id: string }> {
    this.user.trace("Reading file", file);
    const rawData = fs.readFileSync(file);
    const blob = new Blob([rawData]);

    const body = new FormData();
    body.set("published", "false");
    body.set("source", blob, path.basename(file));

    const result = (await this.api.postForm("%PAGE%/photos", body)) as {
      id: "string";
    };

    if (!result["id"]) {
      throw this.user.error("No id returned after uploading photo " + file);
    }
    return result;
  }

  /**
   * Get a link to an uploaded facebook photo
   * @param id - id of the uploaded photo
   * @returns link to the largest derivate of that photo to use in post attachments
   */
  private async getImageLink(id: string): Promise<string> {
    // get photo derivatives
    const photoData = (await this.api.get(id, {
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
      throw this.user.error("No derivates found for photo " + id);
    }

    // find largest derivative
    const largestPhoto = photoData.images?.reduce(function (prev, current) {
      return prev && prev.width > current.width ? prev : current;
    });
    if (!largestPhoto["source"]) {
      throw this.user.error(
        "Largest derivate for photo " + id + " has no source",
      );
    }
    return largestPhoto["source"];
  }

  /**
   * POST an video to the facebook page/videos endpoint
   * @param file - path to the file to post
   * @returns id of the uploaded video to use in post attachments
   */

  private async uploadVideo(file: string): Promise<{ id: string }> {
    this.user.trace("Reading file", file);
    const rawData = fs.readFileSync(file);
    const blob = new Blob([rawData]);

    const body = new FormData();
    body.set("title", "Fairpost temp instagram upload");
    body.set("published", "false");
    body.set("source", blob, path.basename(file));

    const result = (await this.api.postForm("%PAGE%/videos", body)) as {
      id: string;
    };

    if (!result["id"]) {
      throw this.user.error("No id returned when uploading video");
    }
    return result;
  }

  /**
   * Get a link to an uploaded facebook video, polling until it is ready
   * @param id - id of the uploaded video
   * @returns link to the video to use in post attachments
   */

  private async getVideoLink(id: string): Promise<string> {
    const api = this.api;
    const delay = this.pollingDelay;
    const limit = this.pollingLimit;
    let counter = 0;
    return new Promise((resolve, reject) => {
      const poll = async () => {
        counter++;
        this.user.trace("getVideoLink", "Polling video source " + counter);
        const videoData = (await api.get(id, {
          fields: "permalink_url,source",
        })) as {
          permalink_url: string;
          source: string;
        };
        if (videoData.source) {
          this.user.trace(
            "getVideoLink",
            "Video source ready",
            videoData.source,
          );
          resolve(videoData.source);
        } else {
          if (counter < limit) {
            setTimeout(poll, delay);
          } else {
            reject("getVideoLink: Failed after max polls " + counter);
          }
        }
      };
      poll();
    });
  }

  /**
   * Waiting for the post status, polling until it is FINISHED
   * @param id - ig container id
   * @returns link to the video to use in post attachments
   */

  private async checkPostStatus(id: string): Promise<boolean> {
    const api = this.api;
    const delay = this.pollingDelay;
    const limit = this.pollingLimit;
    let counter = 0;
    return new Promise((resolve, reject) => {
      const poll = async () => {
        counter++;
        this.user.trace("checkStatus", "Polling post status " + counter);
        const response = (await api.get(id, {
          fields: "status_code",
        })) as {
          status_code: string;
        };
        if (response.status_code === "FINISHED") {
          this.user.trace("checkStatus", "Post status FINISHED");
          resolve(true);
        } else if (response.status_code === "IN_PROGRESS") {
          if (counter < limit) {
            setTimeout(poll, delay);
          } else {
            reject("checkStatus: Failed after max polls " + counter);
          }
        } else {
          reject("checkStatus: Failed with status " + response.status_code);
        }
      };
      poll();
    });
  }
}
