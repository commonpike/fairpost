import OAuth2Client from "./OAuth2Client";
import Logger from "../core/Logger";
import Storage from "../core/Storage";

export default class FacebookAuth extends OAuth2Client {
  GRAPH_API_VERSION: string = "v18.0";

  async setup() {
    const code = await this.requestCode(
      Storage.get("settings", "FACEBOOK_APP_ID"),
    );

    const accessToken = await this.exchangeCode(
      code,
      Storage.get("settings", "FACEBOOK_APP_ID"),
      Storage.get("settings", "FACEBOOK_APP_SECRET"),
    );

    const pageToken = await this.getLLPageToken(
      Storage.get("settings", "FACEBOOK_APP_ID"),
      Storage.get("settings", "FACEBOOK_APP_SECRET"),
      Storage.get("settings", "FACEBOOK_PAGE_ID"),
      accessToken,
    );

    Storage.set("auth", "FACEBOOK_PAGE_ACCESS_TOKEN", pageToken);
  }

  protected async requestCode(clientId: string): Promise<string> {
    const host = Storage.get("settings", "CLIENT_HOSTNAME");
    const port = Number(Storage.get("settings", "CLIENT_PORT"));
    const state = String(Math.random());

    // create auth url
    const url = new URL("https://www.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/dialog/oauth";
    const query = {
      client_id: clientId,
      redirect_uri: "{{redirectUri}}", // super() will handle this
      state: state,
      response_type: "code",
      scope: [
        "pages_manage_engagement",
        "pages_manage_posts",
        "pages_read_engagement",
        //'pages_read_user_engagement',
        "publish_video",
        "business_management",
      ].join(),
    };
    url.search = new URLSearchParams(query).toString();

    const result = await this.requestRemotePermissions(
      "Facebook",
      url.href,
      host,
      port,
    );
    if (result["error"]) {
      const msg = result["error_reason"] + " - " + result["error_description"];
      Logger.error(msg, result);
      throw new Error(msg);
    }
    if (result["state"] !== state) {
      const msg = "Response state does not match request state";
      Logger.error(msg, result);
      throw new Error(msg);
    }
    if (!result["code"]) {
      const msg = "Remote response did not return a code";
      Logger.error(msg, result);
      throw new Error(msg);
    }
    return result["code"] as string;
  }

  protected async exchangeCode(
    code: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const redirectUri = this.getRedirectUri(
      Storage.get("settings", "CLIENT_HOSTNAME"),
      Number(Storage.get("settings", "CLIENT_PORT")),
    );

    const result = await this.get("oauth/access_token", {
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    });

    if (!result["access_token"]) {
      const msg = "Remote response did not return a access_token";
      Logger.error(msg, result);
      throw new Error(msg);
    }

    return result["access_token"];
  }

  /**
   * Get a long lived page access token.
   *
   * This method is used by getPageToken here and getPageToken
   * in the instagram class, to get a long lived page token
   * for either facebook or instagram
   * @param appId - the app id from config
   * @param appSecret - the app secret from config
   * @param pageId - the pageid to get a token for
   * @param userAccessToken - the short lived user token from the api
   * @returns long lived page access token
   */
  protected async getLLPageToken(
    appId: string,
    appSecret: string,
    pageId: string,
    userAccessToken: string,
  ): Promise<string> {
    const appUserId = await this.getAppUserId(userAccessToken);
    const llUserAccessToken = await this.getLLUserAccessToken(
      appId,
      appSecret,
      userAccessToken,
    );

    const query = {
      access_token: llUserAccessToken,
    };
    const data = (await this.get(appUserId + "/accounts", query)) as {
      data: {
        id: string;
        access_token: string;
      }[];
    };
    const llPageAccessToken = data.data?.find((page) => page.id === pageId)[
      "access_token"
    ];

    if (!llPageAccessToken) {
      console.error(data);
      throw new Error(
        "No llPageAccessToken for page " + pageId + "  in response.",
      );
    }

    return llPageAccessToken;
  }

  /**
   * Get a long lived user access token.
   * @param appId - the appid from config
   * @param appSecret - the app secret from config
   * @param userAccessToken - the short lived user access token from api
   * @returns A long lived access token
   */
  private async getLLUserAccessToken(
    appId: string,
    appSecret: string,
    userAccessToken: string,
  ): Promise<string> {
    const query = {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: userAccessToken,
    };
    const data = (await this.get("oauth/access_token", query)) as {
      access_token: string;
    };
    if (!data["access_token"]) {
      console.error(data);
      throw new Error("No llUserAccessToken access_token in response.");
    }

    return data["access_token"];
  }

  /**
   * Get an app scoped user id
   * @param accessToken - a access token returned from api
   * @returns the app scoped user id ('me')
   */
  private async getAppUserId(accessToken: string): Promise<string> {
    const query = {
      fields: "id,name",
      access_token: accessToken,
    };
    const data = (await this.get("me", query)) as {
      id: string;
      name: string;
    };
    if (!data["id"]) {
      console.error(data);
      throw new Error("Can not get app scoped user id.");
    }
    return data["id"];
  }

  // API implementation -------------------

  /**
   * Do a GET request on the graph.
   * @param endpoint - the path to call
   * @param query - query string as object
   */

  private async get(
    endpoint: string = "%USER%",
    query: { [key: string]: string } = {},
  ): Promise<object> {
    const url = new URL("https://graph.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();
    Logger.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
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
      Logger.error("FacebookAuth.handleApiResponse", response);
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
      Logger.error("FacebookAuth.handleApiResponse", error);
      throw new Error(error);
    }
    Logger.trace("FacebookAuth.handleApiResponse", "success");
    return data;
  }

  /**
   * Handle api error
   * @param error - the error returned from fetch
   */
  private handleApiError(error: Error): never {
    Logger.error("FacebookAuth.handleApiError", error);
    throw error;
  }
}
