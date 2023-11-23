import Logger from "../core/Logger";
import Storage from "../core/Storage";
import Platform from "../core/Platform";
import { PlatformId } from ".";
import Folder from "../core/Folder";
import Post from "../core/Post";
import LinkedInAuth from "../auth/LinkedInAuth";
//import { PostStatus } from "../core/Post";
//import * as fs from "fs";
//import * as path from "path";
//import * as sharp from "sharp";

export default class LinkedIn extends Platform {
  id: PlatformId = PlatformId.LINKEDIN;
  LGC_API_VERSION: string = "v2";
  API_VERSION: string = "202304";
  auth: LinkedInAuth;

  constructor() {
    super();
    this.auth = new LinkedInAuth();
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
      name: me["localizedFirstName"] + " " + me["localizedLastName"],
      headline: me["localizedHeadline"],
      alias: me["vanityName"],
    };
  }

  async preparePost(folder: Folder): Promise<Post> {
    const post = await super.preparePost(folder);
    // ...
    post.save();

    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("LinkedIn.publishPost", post, dryrun);

    return super.publishPost(post, dryrun);
  }

  private async testPost() {
    const body = {
      author: "urn:li:organization:93841245",
      commentary: "Sample text Post",
      visibility: "LOGGED_IN",
      distribution: {
        feedDistribution: "NONE",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };
    return await this.postJson("posts", body);
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
    // nb this is the legacy format
    const url = new URL("https://api.linkedin.com");
    url.pathname = this.LGC_API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();

    const accessToken = await this.auth.getAccessToken();

    Logger.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Connection: "Keep-Alive",
        Authorization: "Bearer " + accessToken,
        "User-Agent": Storage.get("settings", "USER_AGENT"),
      },
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Do a json POST request on the api.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  private async postJson(endpoint: string, body = {}): Promise<object> {
    const url = new URL("https://api.linkedin.com");
    url.pathname = "rest/" + endpoint;

    const accessToken = await this.auth.getAccessToken();
    Logger.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Linkedin-Version": this.API_VERSION,
        Authorization: "Bearer " + accessToken,
      },
      body: JSON.stringify(body),
    }).then((res) => this.handleApiResponse(res));
    //.catch((err) => this.handleApiError(err));
  }

  /*
   * Handle api response
   *
   */
  private async handleApiResponse(response: Response): Promise<object> {
    const text = await response.text();
    let data = {} as { [key: string]: unknown };
    try {
      data = JSON.parse(text);
    } catch (err) {
      data["text"] = text;
    }
    if (!response.ok) {
      Logger.error("Linkedin.handleApiResponse", response);
      const error =
        response.status +
        ":" +
        response.statusText +
        " (" +
        data.status +
        "/" +
        data.serviceErrorCode +
        ") " +
        data.message;
      throw new Error(error);
    }
    data["headers"] = {};
    for (const [name, value] of response.headers) {
      data["headers"][name] = value;
    }
    Logger.trace("Linkedin.handleApiResponse", "success");
    return data;
  }

  /*
   * Handle api error
   *
   */
  private handleApiError(error: Error): Promise<object> {
    Logger.error("Linkedin.handleApiError", error);
    throw error;
  }
}
