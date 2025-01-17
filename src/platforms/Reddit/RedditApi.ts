import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities";

import User from "../../models/User";

/**
 * RedditApi: support for reddit platform.
 */

export default class RedditApi {
  API_VERSION = "v1";

  user: User;

  constructor(user: User) {
    this.user = user;
  }

  /**
   * Do a GET request on the api.
   * @param endpoint - the path to call
   * @param query - query string as object
   */

  public async get(
    endpoint: string,
    query: { [key: string]: string } = {},
  ): Promise<object> {
    const url = new URL("https://oauth.reddit.com");
    url.pathname = "api/" + this.API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();

    const accessToken = this.user.get("auth", "REDDIT_ACCESS_TOKEN");

    this.user.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + accessToken,
        "User-Agent": this.user.get("app", "OAUTH_USERAGENT"),
      },
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleRedditError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /**
   * Do a url-encoded POST request on the api.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  public async post(
    endpoint: string,
    body: { [key: string]: string },
  ): Promise<object> {
    const url = new URL("https://oauth.reddit.com");
    //url.pathname = "api/" + this.API_VERSION + "/" + endpoint;
    url.pathname = "api/" + endpoint;

    const accessToken = this.user.get("auth", "REDDIT_ACCESS_TOKEN");
    this.user.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Bearer " + accessToken,
        "User-Agent": this.user.get("app", "OAUTH_USERAGENT"),
      },
      body: new URLSearchParams(body),
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleRedditError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /**
   * Do a FormData POST request on the api.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  public async postForm(endpoint: string, body: FormData): Promise<object> {
    const url = new URL("https://oauth.reddit.com");
    //url.pathname = "api/" + this.API_VERSION + "/" + endpoint;
    url.pathname = "api/" + endpoint;

    const accessToken = this.user.get("auth", "REDDIT_ACCESS_TOKEN");
    this.user.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + accessToken,
        "User-Agent": this.user.get("app", "OAUTH_USERAGENT"),
      },
      body: body,
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleRedditError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /**
   * Handle api error
   *
   * Improve error message and rethrow it.
   * @param error - ApiResponseError
   */
  private async handleRedditError(error: ApiResponseError): Promise<object> {
    if (error.responseData) {
      if (error.responseData.json?.errors?.length) {
        error.message +=
          ":" +
          error.responseData.json.errors[0] +
          "-" +
          error.responseData.json.errors.slice(1).join();
      }
    } else {
      if (error instanceof SyntaxError) {
        // response.json() Unexpected token < in JSON
        error.message += "- perhaps refresh your tokens";
      }
    }
    throw error;
  }
}
