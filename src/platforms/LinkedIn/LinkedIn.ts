import * as fs from "fs";
//import * as path from "path";
import * as sharp from "sharp";

import { handleApiError, handleEmptyResponse } from "../../utilities";

import Folder from "../../models/Folder";
import LinkedInApi from "./LinkedInApi";
import LinkedInAuth from "./LinkedInAuth";
import Logger from "../../services/Logger";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import Storage from "../../services/Storage";

export default class LinkedIn extends Platform {
  id: PlatformId = PlatformId.LINKEDIN;
  assetsFolder = "_linkedin";
  postFileName = "post.json";

  api: LinkedInApi;
  auth: LinkedInAuth;

  POST_AUTHOR = "";
  POST_VISIBILITY = "PUBLIC"; // CONNECTIONS|PUBLIC|LOGGEDIN|CONTAINER
  POST_DISTRIBUTION = {
    feedDistribution: "MAIN_FEED", // NONE|MAINFEED|CONTAINER_ONLY
    targetEntities: [],
    thirdPartyDistributionChannels: [],
  };
  POST_NORESHARE = false;

  constructor() {
    super();
    this.api = new LinkedInApi();
    this.auth = new LinkedInAuth();
    this.POST_AUTHOR =
      "urn:li:organization:" +
      Storage.get("settings", "LINKEDIN_COMPANY_ID", "");
  }

  /** @inheritdoc */
  async setup() {
    return await this.auth.setup();
  }

  /** @inheritdoc */
  async test() {
    return this.getProfile();
  }

  /** @inheritdoc */
  async refresh(): Promise<boolean> {
    await this.auth.refresh();
    return true;
  }

  /** @inheritdoc */
  async preparePost(folder: Folder): Promise<Post> {
    Logger.trace("LinkedIn.preparePost", folder.id);
    const post = await super.preparePost(folder);
    if (post) {
      // linkedin: prefer video, max 1 video
      if (post.hasFiles("video")) {
        post.limitFiles("video", 1);
        post.removeFiles("image");
      }

      // linkedin: max 5mb images
      for (const file of post.getFiles("image")) {
        const src = file.name;
        const dst = this.assetsFolder + "/linkedin-" + src;
        if (file.size / (1024 * 1024) >= 5) {
          Logger.trace("Resizing " + src + " for linkedin ..");
          await sharp(post.getFilePath(src))
            .resize({
              width: 1200,
            })
            .toFile(post.getFilePath(dst));
          await post.replaceFile(src, dst);
        }
      }
      post.save();
    }
    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("LinkedIn.publishPost", post.id, dryrun);

    let response = { id: "-99" } as {
      id?: string;
      headers?: { [key: string]: string };
    };
    let error = undefined;

    if (post.hasFiles("video")) {
      try {
        response = await this.publishVideoPost(post, dryrun);
      } catch (e) {
        error = e;
      }
    } else if (post.getFiles("image").length > 1) {
      try {
        response = await this.publishImagesPost(post, dryrun);
      } catch (e) {
        error = e;
      }
    } else if (post.getFiles("image").length === 1) {
      try {
        response = await this.publishImagePost(post, dryrun);
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
      "https://www.linkedin.com/feed/update/" + response.id,
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
   * GET part of the profile
   * @returns object, incl. some ids and names
   */
  private async getProfile() {
    const me = await this.api.get("me");
    if (!me) return false;
    return {
      id: me["id"],
      name: me["localizedFirstName"] + " " + me["localizedLastName"],
      headline: me["localizedHeadline"],
      alias: me["vanityName"],
    };
  }

  /**
   * POST title & body to the posts endpoint using json
   * @param post
   * @param dryrun
   * @returns object, incl. id of the created post
   */
  private async publishTextPost(post: Post, dryrun: boolean = false) {
    Logger.trace("LinkedIn.publishTextPost");
    const body = {
      author: this.POST_AUTHOR,
      commentary: post.getCompiledBody(),
      visibility: this.POST_VISIBILITY,
      distribution: this.POST_DISTRIBUTION,
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: this.POST_NORESHARE,
    };
    if (!dryrun) {
      return await this.api.postJson("posts", body, true);
    }
    return { id: "-99" };
  }

  /**
   * POST title & body & image to the posts endpoint using json
   *
   * uploads image using a leash
   * @param post
   * @param dryrun
   * @returns object, incl. id of the created post
   */
  private async publishImagePost(post: Post, dryrun: boolean = false) {
    Logger.trace("LinkedIn.publishImagePost");
    const title = post.title;
    const image = post.getFilePath(post.getFiles("image")[0].name);
    const leash = await this.getImageLeash();
    await this.uploadImage(leash.value.uploadUrl, image);
    // TODO: save headers[etag] ..
    // https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/videos-api?view=li-lms-2023-10&tabs=http#sample-response-4
    const body = {
      author: this.POST_AUTHOR,
      commentary: post.getCompiledBody("!title"),
      visibility: this.POST_VISIBILITY,
      distribution: this.POST_DISTRIBUTION,
      content: {
        media: {
          title: title,
          id: leash.value.image,
        },
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: this.POST_NORESHARE,
    };
    if (!dryrun) {
      return await this.api.postJson("posts", body, true);
    }
    return { id: "-99" };
  }

  /**
   * POST title & body to the posts endpoint using json
   *
   * uploads images using a leash
   * @param post
   * @param dryrun
   * @returns object, incl. id of the created post
   */

  private async publishImagesPost(post: Post, dryrun: boolean = false) {
    Logger.trace("LinkedIn.publishImagesPost");
    const images = post
      .getFiles("image")
      .map((image) => post.getFilePath(image.name));
    const imageIds = [];
    for (const image of images) {
      const leash = await this.getImageLeash();
      await this.uploadImage(leash.value.uploadUrl, image);
      // TODO: save headers[etag] ..
      // https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/videos-api?view=li-lms-2023-10&tabs=http#sample-response-4
      imageIds.push(leash.value.image);
    }

    const body = {
      author: this.POST_AUTHOR,
      commentary: post.getCompiledBody(),
      visibility: this.POST_VISIBILITY,
      distribution: this.POST_DISTRIBUTION,
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: this.POST_NORESHARE,
      content: {
        multiImage: {
          images: imageIds.map((id) => {
            return {
              altText: "",
              id: id,
            };
          }),
        },
      },
    };
    if (!dryrun) {
      return await this.api.postJson("posts", body, true);
    }
    return { id: "-99" };
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
    Logger.trace("LinkedIn.publishVideoPost");

    const title = post.title;
    const video = post.getFilePath(post.getFiles("video")[0].name);

    const leash = await this.getVideoLeash(video);
    await this.uploadVideo(leash.value.uploadInstructions[0].uploadUrl, video);
    // TODO: save headers[etag] ..
    // https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/videos-api?view=li-lms-2023-10&tabs=http#sample-response-4
    const body = {
      author: this.POST_AUTHOR,
      commentary: post.getCompiledBody("!title"),
      visibility: this.POST_VISIBILITY,
      distribution: this.POST_DISTRIBUTION,
      content: {
        media: {
          title: title,
          id: leash.value.video,
        },
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: this.POST_NORESHARE,
    };
    if (!dryrun) {
      return await this.api.postJson("posts", body, true);
    }
    return { id: "-99" };
  }

  /**
   * Get a leash to upload an image
   * @returns object, incl. uploadUrl
   */

  private async getImageLeash(): Promise<{
    value: {
      uploadUrlExpiresAt: number;
      uploadUrl: string;
      image: string;
    };
  }> {
    Logger.trace("LinkedIn.getImageLeash");
    const response = (await this.api.postJson(
      "images?action=initializeUpload",
      {
        initializeUploadRequest: {
          owner: this.POST_AUTHOR,
        },
      },
    )) as {
      value: {
        uploadUrlExpiresAt: number;
        uploadUrl: string;
        image: string;
      };
    };
    if (!response.value) {
      throw Logger.error("LinkedIn.getImageUploadLease: Bad response");
    }
    return response;
  }

  /**
   * Upload an image file to an url
   * @param leashUrl
   * @param file
   * @returns empty
   */
  private async uploadImage(leashUrl: string, file: string) {
    Logger.trace("LinkedIn.uploadImage");
    const rawData = fs.readFileSync(file);
    Logger.trace("PUT", leashUrl);
    const accessToken = Storage.get("auth", "LINKEDIN_ACCESS_TOKEN");
    return await fetch(leashUrl, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + accessToken,
      },
      body: rawData,
    })
      .then((res) => handleEmptyResponse(res))
      .catch((err) => this.api.handleLinkedInError(err))
      .catch((err) => handleApiError(err));
  }

  /**
   * Get a leash to upload an video
   *
   * untested
   * @param file
   * @returns object, incl. uploadUrl
   */
  private async getVideoLeash(file: string): Promise<{
    value: {
      uploadUrlsExpireAt: number;
      video: string;
      uploadInstructions: {
        uploadUrl: string;
        lastByte: number;
        firstByte: number;
      }[];
      uploadToken: string;
    };
  }> {
    Logger.trace("LinkedIn.getVideoLeash");
    const stats = fs.statSync(file);
    const response = (await this.api.postJson(
      "videos?action=initializeUpload",
      {
        initializeUploadRequest: {
          owner: this.POST_AUTHOR,
          fileSizeBytes: stats.size,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      },
    )) as {
      value: {
        uploadUrlsExpireAt: number;
        video: string;
        uploadInstructions: {
          uploadUrl: string;
          lastByte: number;
          firstByte: number;
        }[];
        uploadToken: string;
      };
    };
    if (!response.value) {
      throw Logger.error("LinkedIn.getVideoUploadLease: Bad response");
    }
    return response;
  }

  /**
   * Upload a video file to an url
   *
   * untested
   * @param leashUrl
   * @param file
   * @returns empty
   */
  private async uploadVideo(leashUrl: string, file: string) {
    Logger.trace("LinkedIn.uploadVideo");
    const rawData = fs.readFileSync(file);
    Logger.trace("PUT", leashUrl);
    return await fetch(leashUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: rawData,
    })
      .then((res) => handleEmptyResponse(res))
      .catch((err) => this.api.handleLinkedInError(err))
      .catch((err) => handleApiError(err));
  }
}
