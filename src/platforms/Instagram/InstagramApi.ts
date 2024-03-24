import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities";

import User from "../../models/User";

/**
 * InstagramApi: support for instagram platform.
 */

export default class InstagramApi {
  GRAPH_API_VERSION = "v18.0";

  user: User;

  constructor(user: User) {
    this.user = user;
  }

  /**
   * Do a GET request on the graph.
   * @param endpoint - the path to call
   * @param query - querystring as object
   * @returns parsed response
   */

  public async get(
    endpoint: string = "%USER%",
    query: { [key: string]: string } = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      this.user.get("settings", "INSTAGRAM_USER_ID"),
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      this.user.get("settings", "INSTAGRAM_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();
    const accessToken = this.user.get("auth", "INSTAGRAM_PAGE_ACCESS_TOKEN");
    this.user.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: accessToken
        ? {
            Accept: "application/json",
            Authorization: "Bearer " + accessToken,
          }
        : {
            Accept: "application/json",
          },
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleInstagramError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /**
   * Do a Json POST request on the graph.
   * @param endpoin - the path to call
   * @param body - body as object
   * @returns the parsed response as object
   */

  public async postJson(
    endpoint: string = "%USER%",
    body = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      this.user.get("settings", "INSTAGRAM_USER_ID"),
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      this.user.get("settings", "INSTAGRAM_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    this.user.trace("POST", url.href);
    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization:
          "Bearer " + this.user.get("auth", "INSTAGRAM_PAGE_ACCESS_TOKEN"),
      },
      body: JSON.stringify(body),
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleInstagramError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /**
   * Do a FormData POST request on the graph.
   * @param endpoint - the path to call
   * @param body - body as object
   * @returns the parsed response as object
   */

  public async postForm(endpoint: string, body: FormData): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      this.user.get("settings", "INSTAGRAM_USER_ID"),
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      this.user.get("settings", "INSTAGRAM_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    this.user.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization:
          "Bearer " + this.user.get("auth", "INSTAGRAM_PAGE_ACCESS_TOKEN"),
      },
      body: body,
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleInstagramError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /**
   * Handle api error
   *
   * Improve error message and rethrow it.
   * @param error - ApiResponseError
   */
  private async handleInstagramError(error: ApiResponseError): Promise<never> {
    if (error.responseData) {
      if (error.responseData.error) {
        error.message +=
          ": " +
          error.responseData.error.type +
          " (" +
          error.responseData.error.code +
          "/" +
          (error.responseData.error.error_subcode || "0") +
          "): " +
          error.responseData.error.message;
      }
    }
    throw error;
  }
}
