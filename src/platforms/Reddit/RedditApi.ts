import Logger from "../../services/Logger";
import Storage from "../../services/Storage";

export default class RedditApi {
  API_VERSION = "v1";

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

    const accessToken = Storage.get("auth", "REDDIT_ACCESS_TOKEN");

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

  public async post(
    endpoint: string,
    body: { [key: string]: string },
  ): Promise<object> {
    const url = new URL("https://oauth.reddit.com");
    //url.pathname = "api/" + this.API_VERSION + "/" + endpoint;
    url.pathname = "api/" + endpoint;

    const accessToken = Storage.get("auth", "REDDIT_ACCESS_TOKEN");
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

  public async postFormData(endpoint: string, body: FormData): Promise<object> {
    const url = new URL("https://oauth.reddit.com");
    //url.pathname = "api/" + this.API_VERSION + "/" + endpoint;
    url.pathname = "api/" + endpoint;

    const accessToken = Storage.get("auth", "REDDIT_ACCESS_TOKEN");
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
      throw Logger.error(
        "Reddit.handleApiResponse",
        "not ok",
        response.status + ":" + response.statusText,
      );
    }
    const data = await response.json();
    if (data.json?.errors?.length) {
      const error =
        response.status +
        ":" +
        data.json.errors[0] +
        "-" +
        data.json.errors.slice(1).join();
      throw Logger.error("Reddit.handleApiResponse", error);
    }
    Logger.trace("Reddit.handleApiResponse", "success");
    return data;
  }

  /**
   * Handle api error
   * @param error - the error returned from fetch
   */
  private handleApiError(error: Error): never {
    throw Logger.error("Reddit.handleApiError", error);
  }
}
