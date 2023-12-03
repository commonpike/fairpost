import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

import Post, { PostStatus } from "../models/Post";

import Folder from "../models/Folder";
import Logger from "../services/Logger";
import Platform from "../models/Platform";
import { PlatformId } from ".";
import RedditAuth from "../auth/RedditAuth";
import Storage from "../services/Storage";
import { XMLParser } from "fast-xml-parser";

/**
 * Reddit: support for reddit platform
 */
export default class Reddit extends Platform {
  id = PlatformId.REDDIT;

  SUBREDDIT: string;
  API_VERSION = "v1";
  auth: RedditAuth;

  constructor() {
    super();
    this.SUBREDDIT = Storage.get("settings", "REDDIT_SUBREDDIT");
    this.auth = new RedditAuth();
  }

  /** @inheritdoc */
  async setup() {
    return await this.auth.setup();
  }

  /** @inheritdoc */
  async test() {
    const me = await this.get("me");
    if (!me) return false;
    return {
      id: me["id"],
      name: me["name"],
    };
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    const post = await super.preparePost(folder);
    if (post) {
      // reddit: max 1 image or video
      // TODO: extract video thumbnail
      if (false && post.files.video.length >= 1) { // eslint-disable-line
        post.files.video.length = 1;
        post.files.image = [];
      } else if (post.files.image.length > 1) {
        // <MaxSizeAllowed>20971520</MaxSizeAllowed>
        const image = post.files.image[0];
        const metadata = await sharp(post.folder.path + "/" + image).metadata();
        if (metadata.width > 3000) {
          Logger.trace("Resizing " + image + " for reddit ..");
          const extension = image.split(".")?.pop();
          const basename = path.basename(
            image,
            extension ? "." + extension : "",
          );
          const outfile = "_reddit-" + basename + ".jpg";
          await sharp(post.folder.path + "/" + image)
            .resize({
              width: 3000,
            })
            .toFile(post.folder.path + "/" + outfile);
          post.files.image = [outfile];
        }
      }
      post.save();
    }
    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("Reddit.publishPost", post, dryrun);

    let response = dryrun ? { dryrun: true } : {};
    let error = undefined;

    try {
      if (post.files.video.length) {
        response = await this.publishVideo(
          post.title,
          post.folder.path + "/" + post.files.video[0],
          dryrun,
        );
      } else if (post.files.image.length) {
        response = await this.publishImage(
          post.title,
          post.folder.path + "/" + post.files.image[0],
          dryrun,
        );
      } else {
        response = await this.publishText(post.title, post.body, dryrun);
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
      Logger.error("Reddit.publishPost", this.id, "failed", response);
    } else if (!dryrun) {
      // post.link = ""; // todo : await reddit websockets
      post.status = PostStatus.PUBLISHED;
      post.published = new Date();
    }

    post.save();
    return !error;
  }

  private async publishText(
    title: string,
    body: string,
    dryrun = false,
  ): Promise<object> {
    Logger.trace("Reddit.publishText");
    if (!dryrun) {
      return (await this.post("submit", {
        sr: this.SUBREDDIT,
        kind: "self",
        title: title,
        text: body,
        api_type: "json",
        extension: "json",
      })) as {
        json: {
          errors: string[];
          data: {
            user_submitted_page: string;
            websocket_url: string;
          };
        };
      };
    }
    return {
      dryrun: true,
    };
  }

  private async publishImage(
    title: string,
    file: string,
    dryrun = false,
  ): Promise<object> {
    Logger.trace("Reddit.publishImage");
    const lease = await this.getUploadLease(file);
    const imageUrl = await this.uploadFile(lease, file);
    if (!dryrun) {
      return (await this.post("submit", {
        sr: this.SUBREDDIT,
        kind: "image",
        title: title,
        url: imageUrl,
        api_type: "json",
        extension: "json",
      })) as {
        json: {
          errors: string[];
          data: {
            user_submitted_page: string;
            websocket_url: string;
          };
        };
      };
    }
    return {
      dryrun: true,
    };
  }

  private async publishVideo(
    title: string,
    file: string,
    dryrun = false,
  ): Promise<object> {
    Logger.trace("Reddit.publishVideo");
    const lease = await this.getUploadLease(file);
    const videoUrl = await this.uploadFile(lease, file);
    if (!dryrun) {
      return (await this.post("submit", {
        sr: this.SUBREDDIT,
        kind: "video",
        title: title,
        url: videoUrl,
        video_poster_url: "", // TODO
        api_type: "json",
        extension: "json",
      })) as {
        json: {
          errors: string[];
          data: {
            user_submitted_page: string;
            websocket_url: string;
          };
        };
      };
    }
    return {
      dryrun: true,
    };
  }

  private async getUploadLease(file: string): Promise<{
    action: string;
    fields: {
      [name: string]: string;
    };
  }> {
    const filename = path.basename(file);
    const mimetype = Folder.guessMimeType(filename);

    const form = new FormData();
    form.append("filepath", filename);
    form.append("mimetype", mimetype);

    const lease = (await this.postFormData("media/asset.json", form)) as {
      args: {
        action: string;
        fields: {
          name: string;
          value: string;
        }[];
      };
    };
    if (!lease.args?.action || !lease.args?.fields) {
      const msg = "Reddit.getUploadLease: bad answer";
      Logger.error(msg, lease);
      throw new Error(msg);
    }

    return {
      action: "https:" + lease.args.action,
      fields: Object.assign(
        {},
        ...lease.args.fields.map((f) => ({ [f.name]: f.value })),
      ),
    };
  }

  private async uploadFile(
    lease: {
      action: string;
      fields: {
        [name: string]: string;
      };
    },
    file: string,
  ): Promise<string> {
    const buffer = fs.readFileSync(file);
    const filename = path.basename(file);

    const form = new FormData();
    for (const fieldname in lease.fields) {
      form.append(fieldname, lease.fields[fieldname]);
    }
    form.append("file", new Blob([buffer]), filename);
    Logger.trace("POST", lease.action);

    const responseRaw = await fetch(lease.action, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: form,
    });
    const response = await responseRaw.text();
    try {
      const parser = new XMLParser();
      const xml = parser.parse(response);
      const encodedURL = xml.PostResponse.Location;
      if (!encodedURL) {
        const msg = "Reddit.uploadFile: No URL returned";
        Logger.error(msg, xml);
        throw new Error(msg);
      }
      return decodeURIComponent(encodedURL);
    } catch (e) {
      const msg = "Reddit.uploadFile: cant parse xml";
      Logger.error(msg, response);
      throw e;
    }
  }

  // API implementation -------------------

  /**
   * Do a GET request on the api.
   * @param endpoint - the path to call
   * @param query - query string as object
   */

  private async get(
    endpoint: string,
    query: { [key: string]: string } = {},
  ): Promise<object> {
    const url = new URL("https://oauth.reddit.com");
    url.pathname = "api/" + this.API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();

    const accessToken = await this.auth.getAccessToken();

    Logger.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + accessToken,
        "User-Agent": Storage.get("settings", "USER_AGENT"),
      },
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Do a url-encoded POST request on the api.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  private async post(
    endpoint: string,
    body: { [key: string]: string },
  ): Promise<object> {
    const url = new URL("https://oauth.reddit.com");
    //url.pathname = "api/" + this.API_VERSION + "/" + endpoint;
    url.pathname = "api/" + endpoint;

    const accessToken = await this.auth.getAccessToken();
    Logger.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Bearer " + accessToken,
        "User-Agent": Storage.get("settings", "USER_AGENT"),
      },
      body: new URLSearchParams(body),
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Do a FormData POST request on the api.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  private async postFormData(
    endpoint: string,
    body: FormData,
  ): Promise<object> {
    const url = new URL("https://oauth.reddit.com");
    //url.pathname = "api/" + this.API_VERSION + "/" + endpoint;
    url.pathname = "api/" + endpoint;

    const accessToken = await this.auth.getAccessToken();
    Logger.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + accessToken,
        "User-Agent": Storage.get("settings", "USER_AGENT"),
      },
      body: body,
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Handle api response
   * @param response - api response from fetch
   * @returns parsed object from response
   */
  private async handleApiResponse(response: Response): Promise<object> {
    if (!response.ok) {
      Logger.error("Reddit.handleApiResponse", "not ok");
      throw new Error(response.status + ":" + response.statusText);
    }
    const data = await response.json();
    if (data.json?.errors?.length) {
      const error =
        response.status +
        ":" +
        data.json.errors[0] +
        "-" +
        data.json.errors.slice(1).join();
      Logger.error("Reddit.handleApiResponse", error);
      throw new Error(error);
    }
    Logger.trace("Reddit.handleApiResponse", "success");
    return data;
  }

  /**
   * Handle api error
   * @param error - the error returned from fetch
   */
  private handleApiError(error: Error): never {
    Logger.error("Reddit.handleApiError", error);
    throw error;
  }
}
