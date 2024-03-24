import * as fs from "fs";
import * as path from "path";

import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities";

import Folder from "../../models/Folder";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import { randomUUID } from "crypto";

/**
 * Ayrshare base class to extend all ayrshare platforms on
 *
 * publish is handled here; prepeare is handled in subclasses.
 */
export default abstract class Ayrshare extends Platform {
  requiresApproval: boolean = false;

  // map fairpost platforms to ayrshare platforms
  platforms: {
    [platformId in PlatformId]?: string;
  } = {
    [PlatformId.ASYOUTUBE]: "youtube",
    [PlatformId.ASINSTAGRAM]: "instagram",
    [PlatformId.ASFACEBOOK]: "facebook",
    [PlatformId.ASTWITTER]: "twitter",
    [PlatformId.ASTIKTOK]: "tiktok",
    [PlatformId.ASLINKEDIN]: "linkedin",
    [PlatformId.ASREDDIT]: "reddit",
  };

  /** @inheritdoc */
  async test() {
    const APIKEY = this.user.get("settings", "AYRSHARE_API_KEY");
    return await fetch("https://app.ayrshare.com/api/user", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${APIKEY}`,
      },
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleAyrshareError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /** @inheritdoc */
  async preparePost(folder: Folder): Promise<Post> {
    return super.preparePost(folder);
  }

  /**
   * Publish a post for one platform on Ayrshare
   * @param post - the post to publish
   * @param platformOptions - ayrshare options dependant on platform
   * @param dryrun - wether to actually post it
   * @returns boolean for success
   */
  async publishAyrshare(
    post: Post,
    platformOptions: object,
    dryrun: boolean = false,
  ): Promise<boolean> {
    let error = undefined;
    let response = { id: "-99", postIds: [] } as {
      id: string;
      postIds?: {
        postUrl: string;
      }[];
    };

    const media = post
      .getFiles("image", "video")
      .map((f) => post.getFilePath(f.name));

    try {
      const uploads = media.length ? await this.uploadMedia(media) : [];
      if (!dryrun) {
        response = await this.postAyrshare(post, platformOptions, uploads);
      }
    } catch (e) {
      error = e as Error;
    }

    return post.processResult(
      response.id,
      response.postIds?.find((e) => !!e)?.postUrl ?? "#unknown",
      {
        date: new Date(),
        dryrun: dryrun,
        success: !error,
        error: error,
        response: response,
      },
    );
  }

  /**
   * Upload media to ayrshare for publishing later. Uses a leash.
   * @param media - array of path to files
   * @returns array of links to uploaded media
   */
  async uploadMedia(media: string[]): Promise<string[]> {
    const APIKEY = this.user.get("settings", "AYRSHARE_API_KEY");
    const urls = [] as string[];
    for (const file of media) {
      const buffer = fs.readFileSync(file);
      const ext = path.extname(file);
      const basename = path.basename(file, ext);
      const uname = basename + "-" + randomUUID() + ext;
      this.user.trace("Ayrshare.uploadMedia: fetching uploadid...", file);
      const data = (await fetch(
        "https://app.ayrshare.com/api/media/uploadUrl?fileName=" +
          uname +
          "&contentType=" +
          ext.substring(1),
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${APIKEY}`,
          },
        },
      )
        .then((res) => handleJsonResponse(res))
        .catch((err) => this.handleAyrshareError(err))
        .catch((err) => handleApiError(err, this.user))) as {
        uploadUrl: string;
        contentType: string;
        accessUrl: string;
      };

      this.user.trace("Ayrshare.uploadMedia: uploading..", uname, data);

      await fetch(data.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": data.contentType,
          Authorization: `Bearer ${APIKEY}`,
        },
        body: buffer,
      }).catch((error) => {
        throw this.user.error("Failed uploading " + file, error);
      });

      urls.push(data.accessUrl.replace(/ /g, "%20"));
    }
    return urls;
  }

  /**
   * Publish a post for one platform on Ayrshare
   * @param post - the post to publish
   * @param platformOptions - ayrshare options dependant on platform
   * @param uploads - array of urls to uploaded files
   * @returns object conatining ayrshare id and post url
   */
  async postAyrshare(
    post: Post,
    platformOptions: object,
    uploads: string[],
  ): Promise<{
    id: string;
    postIds?: {
      postUrl: string;
    }[];
  }> {
    const APIKEY = this.user.get("settings", "AYRSHARE_API_KEY");
    const scheduleDate = post.scheduled;

    const postPlatform = this.platforms[this.id];
    if (!postPlatform) {
      throw this.user.error(
        "Ayrshare.postAyrshare: No ayrshare platform associated with platform " +
          this.id,
      );
    }
    const body = JSON.stringify(
      uploads.length
        ? {
            post: post.getCompiledBody(), // required
            platforms: [postPlatform], // required
            mediaUrls: uploads,
            scheduleDate: scheduleDate,
            requiresApproval: this.requiresApproval,
            ...platformOptions,
          }
        : {
            post: post.getCompiledBody(), // required
            platforms: [postPlatform], // required
            scheduleDate: scheduleDate,
            requiresApproval: this.requiresApproval,
          },
    );
    this.user.trace("Ayrshare.postAyrshare: publishing...", postPlatform);
    const response = (await fetch("https://app.ayrshare.com/api/post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${APIKEY}`,
      },
      body: body,
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleAyrshareError(err))
      .catch((err) => handleApiError(err, this.user))) as {
      id: string;
      status?: string;
    };

    if (
      response["status"] !== "success" &&
      response["status"] !== "scheduled"
    ) {
      const error =
        "Ayrshare.postAyrshare: Bad result status: " + response["status"];
      throw this.user.error(error);
    }
    return response;
  }

  /**
   * Handle api error
   *
   * Improve error message and rethrow it.
   * @param error - ApiResponseError
   */
  private async handleAyrshareError(error: ApiResponseError): Promise<never> {
    if (error.responseData) {
      if (error.responseData.status === "error") {
        error.message += ": ";
        if (error.responseData.errors) {
          error.responseData.errors.forEach(
            (err: {
              action: string;
              platform: string;
              code: number;
              message: string;
            }) => {
              error.message +=
                err.action +
                "(" +
                err.code +
                "/" +
                err.platform +
                ") " +
                err.message;
            },
          );
        } else {
          error.message +=
            error.responseData.action +
            "(" +
            error.responseData.code +
            ") " +
            error.responseData.message;
        }
      }
    }
    throw error;
  }
}
