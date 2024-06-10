import * as fs from "fs";

import Folder, { FileGroup } from "../../models/Folder";
import { handleApiError, handleEmptyResponse } from "../../utilities";

import LinkedInApi from "./LinkedInApi";
import LinkedInAuth from "./LinkedInAuth";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import User from "../../models/User";
import sharp from "sharp";

export default class LinkedIn extends Platform {
  id: PlatformId = PlatformId.LINKEDIN;
  assetsFolder = "_linkedin";
  postFileName = "post.json";
  pluginsKey = "LINKEDIN_PLUGINS";

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

  constructor(user: User) {
    super(user);
    this.api = new LinkedInApi(user);
    this.auth = new LinkedInAuth(user);
    this.POST_AUTHOR =
      "urn:li:organization:" +
      this.user.get("settings", "LINKEDIN_COMPANY_ID", "");
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
    this.user.trace("LinkedIn.preparePost", folder.id);
    const post = await super.preparePost(folder);
    if (post) {
      /*
      // linkedin: prefer video, max 1 video
      if (post.hasFiles("video")) {
        post.limitFiles("video", 1);
        post.removeFiles("image");
      }
      */

      // linkedin: max 5mb images
      for (const file of post.getFiles(FileGroup.IMAGE)) {
        const src = file.name;
        const dst = this.assetsFolder + "/linkedin-" + src;
        if (file.size / (1024 * 1024) >= 5) {
          this.user.trace("Resizing " + src + " for linkedin ..");
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
    this.user.trace("LinkedIn.publishPost", post.id, dryrun);

    let response = { id: "-99" } as {
      id?: string;
      headers?: { [key: string]: string };
    };
    let error = undefined as Error | undefined;

    if (post.hasFiles(FileGroup.VIDEO)) {
      try {
        response = await this.publishVideoPost(post, dryrun);
      } catch (e) {
        error = e as Error;
      }
    } else if (post.getFiles(FileGroup.IMAGE).length > 1) {
      try {
        response = await this.publishImagesPost(post, dryrun);
      } catch (e) {
        error = e as Error;
      }
    } else if (post.getFiles(FileGroup.IMAGE).length === 1) {
      try {
        response = await this.publishImagePost(post, dryrun);
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
      response.id as string,
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
    const me = (await this.api.get("me")) as {
      id: string;
      localizedFirstName: string;
      localizedLastName: string;
      localizedHeadline: string;
      vanityName: string;
    };
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
    this.user.trace("LinkedIn.publishTextPost");
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
    this.user.trace("LinkedIn.publishImagePost");
    const title = post.title;
    const image = post.getFilePath(post.getFiles(FileGroup.IMAGE)[0].name);
    const leash = await this.getImageLeash();
    await this.uploadImage(leash.value.uploadUrl, image);
    // TODO: save headers[etag] ..
    // https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/videos-api?view=li-lms-2023-10&tabs=http#sample-response-4
    const body = {
      author: this.POST_AUTHOR,
      commentary: post.getCompiledBody(),
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
    this.user.trace("LinkedIn.publishImagesPost");
    const images = post
      .getFiles(FileGroup.IMAGE)
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
    this.user.trace("LinkedIn.publishVideoPost");

    const title = post.title;
    const video = post.getFilePath(post.getFiles(FileGroup.VIDEO)[0].name);

    const leash = await this.getVideoLeash(video);

    if (leash.value.uploadInstructions.length === 1) {
      const chunkId = await this.uploadVideo(
        leash.value.uploadInstructions[0].uploadUrl,
        video,
      );
      await this.uploadVideoFinish(leash.value.video, leash.value.uploadToken, [
        chunkId,
      ]);
    } else {
      const chunkIds = await this.uploadVideoChunks(
        leash.value.uploadInstructions.map((i) => {
          return {
            url: i.uploadUrl,
            start: i.firstByte,
            end: i.lastByte,
          };
        }),
        video,
      );
      await this.uploadVideoFinish(
        leash.value.video,
        leash.value.uploadToken,
        chunkIds,
      );
    }

    const body = {
      author: this.POST_AUTHOR,
      commentary: post.getCompiledBody(),
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
    this.user.trace("LinkedIn.getImageLeash");
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
      throw this.user.error("LinkedIn.getImageUploadLease: Bad response");
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
    this.user.trace("LinkedIn.uploadImage");
    const rawData = fs.readFileSync(file);
    this.user.trace("PUT", leashUrl);
    const accessToken = this.user.get("auth", "LINKEDIN_ACCESS_TOKEN");
    return await fetch(leashUrl, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + accessToken,
      },
      body: rawData,
    })
      .then((res) => handleEmptyResponse(res))
      .catch((err) => this.api.handleLinkedInError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /**
   * Get a leash to upload an video
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
    this.user.trace("LinkedIn.getVideoLeash");
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
      throw this.user.error("LinkedIn.getVideoUploadLease: Bad response");
    }
    return response;
  }

  /**
   * Upload a video file to an url
   * @param leashUrl
   * @param file
   * @returns string : chunkId
   */
  private async uploadVideo(leashUrl: string, file: string): Promise<string> {
    this.user.trace("LinkedIn.uploadVideo");
    const rawData = fs.readFileSync(file);
    this.user.trace("PUT", leashUrl);
    const result = (await fetch(leashUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: rawData,
    })
      .then((res) => handleEmptyResponse(res, true))
      .catch((err) => this.api.handleLinkedInError(err))
      .catch((err) => handleApiError(err, this.user))) as {
      headers: {
        etag: string;
      };
    };
    return result.headers.etag;
  }

  /**
   * Upload a video file in chunks
   * @param leashes
   * @param file
   * @returns array of chunkIds
   */

  private async uploadVideoChunks(
    leashes: {
      url: string;
      start: number;
      end: number; // exclusive
    }[],
    file: string,
  ): Promise<string[]> {
    this.user.trace("LinkedIn.uploadVideoChunks");
    const buffer = fs.readFileSync(file);
    const blob = new Blob([buffer]);
    const results = [];
    for (const leash of leashes) {
      const chunk = blob.slice(leash.start, leash.end + 1);
      this.user.trace("PUT", leash.url, leash.start, leash.end + 1);
      results.push(
        (await fetch(leash.url, {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: chunk,
        })
          .then((res) => handleEmptyResponse(res, true))
          .catch((err) => this.api.handleLinkedInError(err))
          .catch((err) => handleApiError(err, this.user))) as {
          headers: {
            etag: string;
          };
        },
      );
    }
    return results.map((r) => r.headers.etag);
  }

  private async uploadVideoFinish(
    videoId: string,
    uploadToken: string,
    chunkIds: string[],
  ) {
    this.user.trace("LinkedIn.uploadVideoFinish");
    return await this.api.postJson(
      "videos?action=finalizeUpload",
      {
        finalizeUploadRequest: {
          video: videoId,
          uploadToken: uploadToken,
          uploadedPartIds: chunkIds,
        },
      },
      true,
    );
  }
}
