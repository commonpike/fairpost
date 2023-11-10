import Logger from "../core/Logger";
import Platform from "../core/Platform";
import { PlatformId } from ".";
import Folder from "../core/Folder";
import Post from "../core/Post";
import LinkedInAuth from "../auth/LinkedInAuth";
import { PostStatus } from "../core/Post";
import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

export default class LinkedIn extends Platform {
  id: PlatformId = PlatformId.LINKEDIN;
  GRAPH_API_VERSION: string = "v18.0";

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
    super.test();
  }

  async preparePost(folder: Folder): Promise<Post> {
    const post = await super.preparePost(folder);
    // ...
    post.save();

    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("Instagram.publishPost", post, dryrun);

    return super.publishPost(post, dryrun);
  }


  // LinkedIn -------------------

  async getAccessToken(): Promise<string> {
    const url = new URL("https://www.linkedin.com/oauth/v2/accessToken");
    //const body = new FormData();
    //body.set("grant_type", "client_credentials");
    //body.set("client_id", process.env.FAIRPOST_LINKEDIN_CLIENT_ID as string);
    //body.set(
    //  "client_secret",
    //  process.env.FAIRPOST_LINKEDIN_CLIENT_SECRET as string,
    //);

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.FAIRPOST_LINKEDIN_CLIENT_ID,
      client_secret: process.env.FAIRPOST_LINKEDIN_CLIENT_SECRET
    });
    Logger.trace("POST", url.href, body);

    const data = (await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body,
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err))) as {
      access_token: string;
      expires_in: string;
    };

    if (!data["access_token"]) {
      throw new Error("Linkedin.getAccessToken: invalid response");
    }
    return data["access_token"];
  }

  // API implementation -------------------

  /*
   * Do a GET request on the graph.
   *
   * arguments:
   * endpoint: the path to call
   * query: query string as object
   */

  /*
  private async get(
    endpoint: string = "%USER%",
    query: { [key: string]: string } = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      process.env.FAIRPOST_INSTAGRAM_USER_ID,
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      process.env.FAIRPOST_INSTAGRAM_PAGE_ID,
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();
    Logger.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: process.env.FAIRPOST_INSTAGRAM_PAGE_ACCESS_TOKEN
        ? {
            Accept: "application/json",
            Authorization:
              "Bearer " + process.env.FAIRPOST_INSTAGRAM_PAGE_ACCESS_TOKEN,
          }
        : {
            Accept: "application/json",
          },
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }
  */

  /*
   * Do a Json POST request on the graph.
   *
   * arguments:
   * endpoint: the path to call
   * body: body as object
   */

  /*
  
  private async postJson(
    endpoint: string = "%USER%",
    body = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      process.env.FAIRPOST_INSTAGRAM_USER_ID,
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      process.env.FAIRPOST_INSTAGRAM_PAGE_ID,
    );

    const url = new URL("https://api.linkedin.com/");
    url.pathname = this.API_VERSION + "/" + endpoint;
    Logger.trace("POST", url.href);
    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization:
          "Bearer " + process.env.FAIRPOST_INSTAGRAM_PAGE_ACCESS_TOKEN,
      },
      body: JSON.stringify(body),
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }
  */

  /*
   * Do a FormData POST request on the graph.
   *
   * arguments:
   * endpoint: the path to call
   * body: body as object
   */

  /*
  private async postFormData(
    endpoint: string,
    body: FormData,
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      process.env.FAIRPOST_INSTAGRAM_USER_ID,
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      process.env.FAIRPOST_INSTAGRAM_PAGE_ID,
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    Logger.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization:
          "Bearer " + process.env.FAIRPOST_INSTAGRAM_PAGE_ACCESS_TOKEN,
      },
      body: body,
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }
  */

  /*
   * Handle api response
   *
   */
  private async handleApiResponse(response: Response): Promise<object> {
    if (!response.ok) {
      Logger.error("Linkedin.handleApiResponse", response);
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
      Logger.error("Linkedin.handleApiResponse", error);
      throw new Error(error);
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
