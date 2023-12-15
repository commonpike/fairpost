import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities";

import Logger from "../../services/Logger";
import OAuth2Service from "../../services/OAuth2Service";
import Storage from "../../services/Storage";
import { strict as assert } from "assert";

export default class FacebookAuth {
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
    const state = String(Math.random()).substring(2);

    // create auth url
    const url = new URL("https://www.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/dialog/oauth";
    const query = {
      client_id: clientId,
      redirect_uri: OAuth2Service.getCallbackUrl(),
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

    const result = await OAuth2Service.requestRemotePermissions(
      "Facebook",
      url.href,
    );
    if (result["error"]) {
      const msg = result["error_reason"] + " - " + result["error_description"];
      throw Logger.error(msg, result);
    }
    if (result["state"] !== state) {
      const msg = "Response state does not match request state";
      throw Logger.error(msg, result);
    }
    if (!result["code"]) {
      const msg = "Remote response did not return a code";
      throw Logger.error(msg, result);
    }
    return result["code"] as string;
  }

  protected async exchangeCode(
    code: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const redirectUri = OAuth2Service.getCallbackUrl();

    const tokens = (await this.get("oauth/access_token", {
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    })) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw Logger.error(
        "FacebookAuth.exchangeCode: response is not a TokenResponse",
        tokens,
      );
    }

    return tokens["access_token"];
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
      throw Logger.error(
        "No llPageAccessToken for page " + pageId + "  in response.",
        data,
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
    const tokens = (await this.get(
      "oauth/access_token",
      query,
    )) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw Logger.error(
        "FacebookAuth.getLLUserAccessToken: response is not a TokenResponse",
        tokens,
      );
    }
    return tokens["access_token"];
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
      throw Logger.error("Can not get app scoped user id.", data);
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
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleFacebookError(err))
      .catch((err) => handleApiError(err));
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

interface TokenResponse {
  access_token: string;
}

function isTokenResponse(tokens: TokenResponse) {
  try {
    assert("access_token" in tokens);
  } catch (e) {
    return false;
  }
  return true;
}
