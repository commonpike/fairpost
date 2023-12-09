import Logger from "../../services/Logger";
import Storage from "../../services/Storage";

/**
 * FacebookApi: support for facebook platform.
 */

export default class FacebookApi {
  GRAPH_API_VERSION = "v18.0";

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
      Storage.get("settings", "FACEBOOK_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();
    Logger.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization:
          "Bearer " + Storage.get("auth", "FACEBOOK_PAGE_ACCESS_TOKEN"),
      },
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
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
      Storage.get("settings", "FACEBOOK_PAGE_ID"),
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
          "Bearer " + Storage.get("settings", "FACEBOOK_PAGE_ACCESS_TOKEN"),
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
   */

  public async postFormData(endpoint: string, body: FormData): Promise<object> {
    endpoint = endpoint.replace(
      "%PAGE%",
      Storage.get("settings", "FACEBOOK_PAGE_ID"),
    );

    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    Logger.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization:
          "Bearer " + Storage.get("settings", "FACEBOOK_PAGE_ACCESS_TOKEN"),
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
        "Facebook.handleApiResponse",
        response,
        response.status + ":" + response.statusText,
      );
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
   * @param error - the error returned from fetch
   */
  private handleApiError(error: Error): never {
    throw Logger.error("Facebook.handleApiError", error);
  }
}
