import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities";

import User from "../../models/User";

/**
 * FacebookApi: support for facebook platform.
 */

export default class FacebookApi {
  GRAPH_API_VERSION = "v22.0";

  user: User;

  constructor(user: User) {
    this.user = user;
  }

  /**
   * Do a GET request on the graph.
   * @param endpoint - the path to call
   * @param query - query string as object
   */

  public async get(
    endpoint: string = "%PAGE%",
    query: { [key: string]: string } = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%PAGE%",
      this.user.get("settings", "FACEBOOK_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();
    this.user.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization:
          "Bearer " + this.user.get("auth", "FACEBOOK_PAGE_ACCESS_TOKEN"),
      },
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleFacebookError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /**
   * Do a Json POST request on the graph.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  public async postJson(
    endpoint: string = "%PAGE%",
    body = {},
  ): Promise<object> {
    endpoint = endpoint.replace(
      "%PAGE%",
      this.user.get("settings", "FACEBOOK_PAGE_ID"),
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
          "Bearer " + this.user.get("auth", "FACEBOOK_PAGE_ACCESS_TOKEN"),
      },
      body: JSON.stringify(body),
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleFacebookError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /**
   * Do a FormData POST request on the graph.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  public async postForm(endpoint: string, body: FormData): Promise<object> {
    endpoint = endpoint.replace(
      "%PAGE%",
      this.user.get("settings", "FACEBOOK_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    this.user.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization:
          "Bearer " + this.user.get("auth", "FACEBOOK_PAGE_ACCESS_TOKEN"),
      },
      body: body,
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleFacebookError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /**
   * Handle api error
   *
   * Improve error message and rethrow it.
   * @param error - ApiResponseError
   */
  private async handleFacebookError(error: ApiResponseError): Promise<never> {
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
