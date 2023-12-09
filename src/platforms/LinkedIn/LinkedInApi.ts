import Logger from "../../services/Logger";
import Storage from "../../services/Storage";

/**
 * LinkedInApi: support for linkedin platform.
 */

export default class LinkedInApi {
  LGC_API_VERSION = "v2";
  API_VERSION = "202304";

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

    const accessToken = Storage.get("auth", "LINKEDIN_ACCESS_TOKEN");

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

  public async postJson(endpoint: string, body = {}): Promise<object> {
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
    }).then((res) => this.handleApiResponse(res));
    //.catch((err) => this.handleApiError(err));
  }

  /*
   * Handle api response
   *
   */
  public async handleApiResponse(response: Response): Promise<object> {
    const text = await response.text();
    let data = {} as { [key: string]: unknown };
    try {
      data = JSON.parse(text);
    } catch (err) {
      data["text"] = text;
    }
    if (!response.ok) {
      Logger.warn("Linkedin.handleApiResponse", response);
      Logger.warn(response.headers);
      const linkedInErrorResponse =
        response.headers["x-linkedin-error-response"];

      const error =
        response.status +
        ":" +
        response.statusText +
        " (" +
        data.status +
        "/" +
        data.serviceErrorCode +
        ") " +
        data.message +
        " - " +
        linkedInErrorResponse;

      throw Logger.error(error);
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
  public handleApiError(error: Error): Promise<object> {
    throw Logger.error("Linkedin.handleApiError", error);
  }
}
