import Logger from "../Logger";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { PlatformId } from ".";
import Platform from "../Platform";
import Folder from "../Folder";
import Post from "../Post";
import { PostStatus } from "../Post";

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
      Logger.error("Ayrshare.publishPost", this.id, "failed", response);
    }

    if (!dryrun) {
      if (!error) {
        post.link = response.postIds?.find(e=>!!e)?.postUrl ?? "";
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
    const APIKEY = process.env.FAIRPOST_AYRSHARE_API_KEY;
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
      }).catch(error => {
          Logger.error(error);
          throw new Error('Failed uploading '+file);
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
    const APIKEY = process.env.FAIRPOST_AYRSHARE_API_KEY;
    const scheduleDate = post.scheduled;
    //scheduleDate.setDate(scheduleDate.getDate()+100);

    const postPlatform = this.platforms[this.id];
    if (!postPlatform) {
      throw new Error(
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
      Logger.error(error);
      throw new Error(error);
    }
    return response;
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
    if (data.status === "error") {
      let error = response.status + ":";
      data.status.errors.forEach(
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
      Logger.error("Ayrshare.handleApiResponse", error);
      throw new Error(error);
    }
    Logger.trace("Ayrshare.handleApiResponse", "success");
    return data;
  }

  /*
   * Handle api error
   *
   */
  private handleApiError(error: Error): Promise<object> {
    Logger.error("Ayrshare.handleApiError", error);
    throw error;
  }
}
