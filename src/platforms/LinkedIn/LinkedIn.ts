import * as fs from "fs";
//import * as path from "path";
import * as sharp from "sharp";

import Folder from "../../models/Folder";
import LinkedInApi from "./LinkedInApi";
import LinkedInAuth from "./LinkedInAuth";
import Logger from "../../services/Logger";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import { PostStatus } from "../../models/Post";
import Storage from "../../services/Storage";

export default class LinkedIn extends Platform {
  id: PlatformId = PlatformId.LINKEDIN;
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

  async preparePost(folder: Folder): Promise<Post> {
    const post = await super.preparePost(folder);
    if (post) {
      // linkedin: prefer video, max 1 video
      if (post.files.video.length) {
        post.files.video.length = 1;
        post.files.image = [];
      }

      // linkedin: max 5mb images
      for (const src of post.files.image) {
        const dst = this.assetsFolder() + "/linkedin-" + src;
        const size = fs.statSync(post.getFullPath(src)).size / (1024 * 1024);
        if (size >= 5) {
          Logger.trace("Resizing " + src + " for linkedin ..");
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

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("LinkedIn.publishPost", post.id, dryrun);

    let response = dryrun
      ? { id: "-99" }
      : ({} as { id?: string; headers?: { [key: string]: string } });
    let error = undefined;

    if (post.files.video.length) {
      if (!dryrun) {
        try {
          response = await this.publishVideo(
            post.title,
            post.body,
            post.folder.path + "/" + post.files.video[0],
          );
        } catch (e) {
          error = e;
        }
      }
    } else if (post.files.image.length > 1) {
      if (!dryrun) {
        try {
          response = await this.publishImages(
            post.title + "\n\n" + post.body,
            post.files.image.map((image) => post.folder.path + "/" + image),
          );
        } catch (e) {
          error = e;
        }
      }
    } else if (post.files.image.length === 1) {
      if (!dryrun) {
        try {
          response = await this.publishImage(
            post.title,
            post.body,
            post.folder.path + "/" + post.files.image[0],
          );
        } catch (e) {
          error = e;
        }
      }
    } else {
      try {
        if (!dryrun) {
          response = await this.publishText(post.title + "\n\n" + post.body);
        }
      } catch (e) {
        error = e;
      }
    }

    if (response.headers["x-restli-id"]) {
      response.id = response.headers["x-restli-id"];
    }

    post.results.push({
      date: new Date(),
      dryrun: dryrun,
      success: !error,
      error: error,
      response: response,
    });

    if (error) {
      Logger.warn("Facebook.publishPost", this.id, "failed", response);
    }

    if (!dryrun) {
      if (!error) {
        post.link = "https://www.linkedin.com/feed/update/" + response.id;
        post.status = PostStatus.PUBLISHED;
        post.published = new Date();
      } else {
        post.status = PostStatus.FAILED;
      }
    }

    post.save();
    return !error;
  }

  // Platform API Specific

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

  private async publishText(content: string) {
    const body = {
      author: this.POST_AUTHOR,
      commentary: content,
      visibility: this.POST_VISIBILITY,
      distribution: this.POST_DISTRIBUTION,
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: this.POST_NORESHARE,
    };
    return await this.api.postJson("posts", body);
  }
  private async publishImage(title: string, content: string, image: string) {
    const leash = await this.getImageLeash();
    await this.uploadImage(leash.value.uploadUrl, image);
    const body = {
      author: this.POST_AUTHOR,
      commentary: content,
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
    return await this.api.postJson("posts", body);
  }

  private async publishImages(content: string, images: string[]) {
    const imageIds = [];
    for (const image of images) {
      const leash = await this.getImageLeash();
      await this.uploadImage(leash.value.uploadUrl, image);
      imageIds.push(leash.value.image);
    }

    const body = {
      author: this.POST_AUTHOR,
      commentary: content,
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
    return await this.api.postJson("posts", body);
  }

  // untested
  private async publishVideo(title: string, content: string, video: string) {
    const leash = await this.getVideoLeash(video);
    await this.uploadVideo(leash.value.uploadInstructions[0].uploadUrl, video);
    const body = {
      author: this.POST_AUTHOR,
      commentary: content,
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
    return await this.api.postJson("posts", body);
  }

  private async getImageLeash(): Promise<{
    value: {
      uploadUrlExpiresAt: number;
      uploadUrl: string;
      image: string;
    };
  }> {
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

  private async uploadImage(leashUrl: string, file: string) {
    const rawData = fs.readFileSync(file);
    Logger.trace("PUT", leashUrl);
    return await fetch(leashUrl, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + (await this.auth.getAccessToken()),
      },
      body: rawData,
    }).then((res) => this.api.handleApiResponse(res));
  }

  // untested
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
    const stats = fs.statSync(file);
    const response = (await this.api.postJson(
      "images?videos=initializeUpload",
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

  // untested
  private async uploadVideo(leashUrl: string, file: string) {
    const rawData = fs.readFileSync(file);
    Logger.trace("PUT", leashUrl);
    return await fetch(leashUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: rawData,
    }).then((res) => this.api.handleApiResponse(res));
  }
}
