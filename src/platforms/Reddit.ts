import Storage from "../core/Storage";
import Logger from "../core/Logger";
import RedditAuth from "../auth/RedditAuth";
import { PlatformId } from ".";
import Platform from "../core/Platform";
//import Folder from "../core/Folder";
//import Post, { PostStatus } from "../core/Post";
//import * as fs from "fs";
//import * as sharp from "sharp";

/**
 * Reddit: support for reddit platform
 */
export default class Reddit extends Platform {
  id = PlatformId.REDDIT;
  API_VERSION = "v1";
  auth: RedditAuth;

  constructor() {
    super();
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

  // API implementation -------------------

  /**
   * Do a GET request on the graph.
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
