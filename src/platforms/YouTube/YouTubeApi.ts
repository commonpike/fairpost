import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities";

import Logger from "../../services/Logger";
import Storage from "../../services/Storage";

/**
 * LinkedInApi: support for linkedin platform.
 */

export default class YouTubeApi {
  API_VERSION = "v3";

  /**
   * Do a GET request on the api.
   * @param endpoint - the path to call
   * @param query - query string as object
   */

  public async get(
    endpoint: string,
    query: { [key: string]: string } = {},
  ): Promise<object> {
    const url = new URL("https://www.googleapis.com");
    url.pathname = "/youtube/" + this.API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();

    const accessToken = Storage.get("auth", "YOUTUBE_ACCESS_TOKEN");

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
      .then((res) => handleJsonResponse(res, true))
      .catch((err) => this.handleYouTubeError(err))
      .catch((err) => handleApiError(err));
  }

  /**
   * Do a json POST request on the api.
   * @param endpoint - the path to call
   * @param body - body as object
   
   
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
    const accessToken = Storage.get("auth", "LINKEDIN_ACCESS_TOKEN");
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
   */

  /**
   * Handle api error
   *
   * Improve error message and rethrow it.
   * @param error - ApiResponseError
   */
  public async handleYouTubeError(error: ApiResponseError): Promise<never> {
    if (error.responseData) {
      //
    }
    if (error.response?.headers) {
      //
    }

    throw error;
  }
}
