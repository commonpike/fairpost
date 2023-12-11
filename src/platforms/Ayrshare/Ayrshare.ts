import * as fs from "fs";
import * as path from "path";

import Folder from "../../models/Folder";
import Logger from "../../services/Logger";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
import { PostStatus } from "../../models/Post";
import Storage from "../../services/Storage";
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

  constructor() {
    super();
  }

  /** @inheritdoc */
  async preparePost(folder: Folder): Promise<Post | undefined> {
    return super.preparePost(folder);
  }

  async publishAyrshare(
    post: Post,
    platformOptions: object,
    dryrun: boolean = false,
  ): Promise<boolean> {
    let error = undefined;
    let response = dryrun
      ? { postIds: [] }
      : ({} as {
          postIds?: {
            postUrl: string;
          }[];
        });

    const media = [...post.files.image, ...post.files.video].map(
      (f) => post.folder.path + "/" + f,
    );

    try {
      const uploads = media.length ? await this.uploadMedia(media) : [];
      if (!dryrun) {
        response = await this.postAyrshare(post, platformOptions, uploads);
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
      Logger.warn("Ayrshare.publishPost", this.id, "failed", response);
    }

    if (!dryrun) {
      if (!error) {
        post.link = response.postIds?.find((e) => !!e)?.postUrl ?? "";
        post.status = PostStatus.PUBLISHED;
        post.published = new Date();
      } else {
        post.status = PostStatus.FAILED;
      }
    }

    post.save();
    return !error;
  }

  async uploadMedia(media: string[]): Promise<string[]> {
    const APIKEY = Storage.get("settings", "AYRSHARE_API_KEY");
    const urls = [] as string[];
    for (const file of media) {
      const buffer = fs.readFileSync(file);
      const ext = path.extname(file);
      const basename = path.basename(file, ext);
      const uname = basename + "-" + randomUUID() + ext;
      Logger.trace("fetching uploadid...", file);
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
        .then((res) => this.handleApiResponse(res))
        .catch((err) => this.handleApiError(err))) as {
        uploadUrl: string;
        contentType: string;
        accessUrl: string;
      };

      Logger.trace("uploading..", uname, data);

      await fetch(data.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": data.contentType,
          Authorization: `Bearer ${APIKEY}`,
        },
        body: buffer,
      }).catch((error) => {
        throw Logger.error("Failed uploading " + file, error);
      });

      urls.push(data.accessUrl.replace(/ /g, "%20"));
    }
    return urls;
  }

  async postAyrshare(
    post: Post,
    platformOptions: object,
    uploads: string[],
  ): Promise<object> {
    const APIKEY = Storage.get("settings", "AYRSHARE_API_KEY");
    const scheduleDate = post.scheduled;
    //scheduleDate.setDate(scheduleDate.getDate()+100);

    const postPlatform = this.platforms[this.id];
    if (!postPlatform) {
      throw Logger.error(
        "No ayrshare platform associated with platform " + this.id,
      );
    }
    const body = JSON.stringify(
      uploads.length
        ? {
            post: post.body, // required
            platforms: [postPlatform], // required
            mediaUrls: uploads,
            scheduleDate: scheduleDate,
            requiresApproval: this.requiresApproval,
            ...platformOptions,
          }
        : {
            post: post.body, // required
            platforms: [postPlatform], // required
            scheduleDate: scheduleDate,
            requiresApproval: this.requiresApproval,
          },
    );
    Logger.trace("publishing...", postPlatform);
    const response = (await fetch("https://app.ayrshare.com/api/post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${APIKEY}`,
      },
      body: body,
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err))) as {
      id: string;
      status?: string;
    };

    if (
      response["status"] !== "success" &&
      response["status"] !== "scheduled"
    ) {
      const error = "Bad result status: " + response["status"];
      throw Logger.error(error);
    }
    return response;
  }

  /**
   * Handle api response
   * @param response - the api response
   * @returns parsed data from response
   */
  private async handleApiResponse(response: Response): Promise<object> {
    if (!response.ok) {
      throw Logger.error(
        "Ayrshare.handleApiResponse",
        response,
        response.status + ":" + response.statusText,
      );
    }
    const data = await response.json();
    if (data.status === "error") {
      let error = response.status + ":";
      data.errors.forEach(
        (err: {
          action: string;
          platform: string;
          code: number;
          message: string;
        }) => {
          error +=
            err.action +
            "(" +
            err.code +
            "/" +
            err.platform +
            ") " +
            err.message;
        },
      );
      throw Logger.error("Ayrshare.handleApiResponse", error);
    }
    Logger.trace("Ayrshare.handleApiResponse", "success");
    return data;
  }

  /**
   * Handle api error
   * @param error - the error thrown from the api
   */
  private handleApiError(error: Error) {
    throw Logger.error("Ayrshare.handleApiError", error);
  }
}