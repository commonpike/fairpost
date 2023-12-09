import Logger from "../../services/Logger";
import Storage from "../../services/Storage";

/**
 * InstagramApi: support for instagram platform.
 */

export default class InstagramApi {
  GRAPH_API_VERSION = "v18.0";

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
      Storage.get("settings", "INSTAGRAM_USER_ID"),
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      Storage.get("settings", "INSTAGRAM_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();
    const accessToken = Storage.get("auth", "INSTAGRAM_PAGE_ACCESS_TOKEN");
    Logger.trace("GET", url.href);
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
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
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
      Storage.get("settings", "INSTAGRAM_USER_ID"),
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      Storage.get("settings", "INSTAGRAM_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    Logger.trace("POST", url.href);
    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization:
          "Bearer " + Storage.get("auth", "INSTAGRAM_PAGE_ACCESS_TOKEN"),
      },
      body: JSON.stringify(body),
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Do a FormData POST request on the graph.
   * @param endpoint - the path to call
   * @param body - body as object
   * @returns the parsed response as object
   */

  public async postFormData(endpoint: string, body: FormData): Promise<object> {
    endpoint = endpoint.replace(
      "%USER%",
      Storage.get("settings", "INSTAGRAM_USER_ID"),
    );
    endpoint = endpoint.replace(
      "%PAGE%",
      Storage.get("settings", "INSTAGRAM_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    Logger.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization:
          "Bearer " + Storage.get("settings", "INSTAGRAM_PAGE_ACCESS_TOKEN"),
      },
      body: body,
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Handle api response
   * @param response - the api response from fetch
   * @returns the parsed response
   */
  private async handleApiResponse(response: Response): Promise<object> {
    if (!response.ok) {
      throw Logger.error("Ayrshare.handleApiResponse", response);
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
      throw Logger.error("Facebook.handleApiResponse", error);
    }
    Logger.trace("Facebook.handleApiResponse", "success");
    return data;
  }

  /**
   * Handle api error
   * @param error - the api error returned from fetch
   */
  private handleApiError(error: Error): never {
    throw Logger.error("Facebook.handleApiError", error);
  }
}
