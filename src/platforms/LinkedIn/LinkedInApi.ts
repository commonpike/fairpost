import {
  ApiResponseError,
  handleApiError,
  handleEmptyResponse,
  handleJsonResponse,
} from "../../utilities";

import Logger from "../../services/Logger";
import User from "../../models/User";

/**
 * LinkedInApi: support for linkedin platform.
 */

export default class LinkedInApi {
  LGC_API_VERSION = "v2";
  API_VERSION = "202304";

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
    // nb this is the legacy format
    const url = new URL("https://api.linkedin.com");
    url.pathname = this.LGC_API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();

    const accessToken = this.user.get("auth", "LINKEDIN_ACCESS_TOKEN");

    Logger.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Connection: "Keep-Alive",
        Authorization: "Bearer " + accessToken,
        "User-Agent": this.user.get("settings", "USER_AGENT"),
      },
    })
      .then((res) => handleJsonResponse(res, true))
      .catch((err) => this.handleLinkedInError(err))
      .catch((err) => handleApiError(err));
  }

  /**
   * Do a json POST request on the api.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  public async postJson(
    endpoint: string,
    body = {},
    expectEmptyResponse = false,
  ): Promise<object> {
    const url = new URL("https://api.linkedin.com");

    const [pathname, search] = endpoint.split("?");
    url.pathname = "rest/" + pathname;
    if (search) {
      url.search = search;
    }
    const accessToken = this.user.get("auth", "LINKEDIN_ACCESS_TOKEN");
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
    })
      .then((res) =>
        expectEmptyResponse
          ? handleEmptyResponse(res, true)
          : handleJsonResponse(res, true),
      )
      .then((res) => {
        const linkedinRes = res as {
          id?: string;
          headers?: {
            "x-restli-id"?: string;
            "x-linkedin-id"?: string;
          };
        };
        if (!linkedinRes["id"] && "headers" in linkedinRes) {
          if (linkedinRes.headers?.["x-restli-id"]) {
            linkedinRes["id"] = linkedinRes.headers["x-restli-id"];
          } else if (linkedinRes.headers?.["x-linkedin-id"]) {
            linkedinRes["id"] = linkedinRes.headers["x-linkedin-id"];
          }
        }
        return linkedinRes;
      })
      .catch((err) => this.handleLinkedInError(err))
      .catch((err) => handleApiError(err));
  }

  /**
   * Handle api error
   *
   * Improve error message and rethrow it.
   * @param error - ApiResponseError
   */
  public async handleLinkedInError(error: ApiResponseError): Promise<never> {
    if (error.responseData) {
      error.message +=
        " (" +
        error.responseData.status +
        "/" +
        error.responseData.serviceErrorCode +
        ") " +
        error.responseData.message;
    }
    if (
      error.response?.headers &&
      "x-linkedin-error-response" in error.response.headers
    ) {
      error.message +=
        " - " + error.response.headers["x-linkedin-error-response"];
    }

    throw error;
  }
}
