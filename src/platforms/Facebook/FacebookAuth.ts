import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities.ts";

import { OAuthRequest, OAuthResponse } from "../../types/index.ts";
import OAuth2Service from "../../services/OAuth2Service.ts";
import User from "../../models/User.ts";
import { strict as assert } from "assert";

export default class FacebookAuth {
  GRAPH_API_VERSION: string = "v22.0";

  user: User;

  constructor(user: User) {
    this.user = user;
  }

  /**
   * Connect Facebook platform via cli
   */
  async connectCli() {
    // phase 1 : get the code
    const clientHost = this.user.data.get("app", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.data.get("app", "OAUTH_PORT"));
    const redirectUri = OAuth2Service.getCallbackUrl(clientHost, clientPort);
    const state = String(Math.random()).substring(2);
    const requestUri = this.getRequestUri(redirectUri, state);
    const code = await this.requestCliCode("Facebook", requestUri, state);

    // phase 2: exchange the code for tokens
    const appId = this.user.data.get("app", "FACEBOOK_APP_ID");
    const appSecret = this.user.data.get("app", "FACEBOOK_APP_SECRET");
    const accessToken = await this.exchangeCode(
      appId,
      appSecret,
      code,
      redirectUri,
    );
    const pageToken = await this.getLLPageToken(
      appId,
      appSecret,
      this.user.data.get("settings", "FACEBOOK_PAGE_ID"),
      accessToken,
    );

    this.user.data.set("auth", "FACEBOOK_PAGE_ACCESS_TOKEN", pageToken);
    await this.user.data.save();
  }

  /**
   * Connect Facebook platform via api
   *
   * OAuth basic flow is called in two phases:
   * - phase1 has redirect_uri and a state - will return a { url: string }
   * - phase2 has a code - will exchange for tokens and return { ready: true }
   * @param payload OAuthRequest
   * @returns OAuthResponse
   */
  async connectApi(payload: OAuthRequest): Promise<OAuthResponse> {
    if (!payload || payload.flow !== "basic") {
      throw this.user.log.error(
        "FacebookAuth.connectApi: Payload flow must be basic",
        payload,
      );
    }
    if (payload.phase === "start") {
      if (!payload.redirect_uri) {
        throw this.user.log.error(
          "FacebookAuth.connectApi: Payload:start missing redirect_uri",
          payload,
        );
      }
      return {
        phase: "start",
        flow: "basic",
        request_uri: this.getRequestUri(payload.redirect_uri, payload.state),
      };
    }
    if (payload.phase === "finish") {
      if (payload.error !== undefined) {
        const msg =
          payload.error + " - " + (payload.error_description ?? "unknown");
        throw this.user.log.error(msg, payload);
      }
      if (!payload.code || !payload.redirect_uri) {
        throw this.user.log.error(
          "FacebookAuth.connectApi: Payload:finish missing code and/or redirect_uri",
          payload,
        );
      }
      const appId = this.user.data.get("app", "FACEBOOK_APP_ID");
      const appSecret = this.user.data.get("app", "FACEBOOK_APP_SECRET");
      const accessToken = await this.exchangeCode(
        appId,
        appSecret,
        payload.code,
        payload.redirect_uri,
      );
      const pageToken = await this.getLLPageToken(
        appId,
        appSecret,
        this.user.data.get("settings", "FACEBOOK_PAGE_ID"),
        accessToken,
      );
      this.user.data.set("auth", "FACEBOOK_PAGE_ACCESS_TOKEN", pageToken);
      await this.user.data.save();

      return {
        phase: "finish",
        flow: "basic",
        authenticated: true,
      };
    }
    throw this.user.log.error("LinkedInAuth.connect: Unknown phase", payload);
  }

  /**
   * Get oauth2 url to request a code
   * @param redirectUri
   * @param state
   * @returns string
   */
  protected getRequestUri(redirectUri: string, state?: string): string {
    this.user.log.trace("FacebookAuth", "requestCode");
    const clientId = this.user.data.get("app", "FACEBOOK_APP_ID");
    const url = new URL("https://www.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/dialog/oauth";
    const query = {
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state ?? "connect",
      response_type: "code",
      scope: [
        "pages_manage_engagement",
        "pages_manage_posts",
        "pages_read_engagement",
        //'pages_read_user_engagement',
        "publish_video",
        "business_management",
        "pages_show_list",
      ].join(),
    };
    url.search = new URLSearchParams(query).toString();
    return url.href;
  }

  /**
   * Request remote code using OAuth2Service as a local server
   * @param platformName
   * @param requestUri
   * @param state
   * @returns - code
   */
  protected async requestCliCode(
    platformName: string,
    requestUri: string,
    state: string,
  ): Promise<string> {
    this.user.log.trace("FacebookAuth", "requestCliCode");
    const clientHost = this.user.data.get("app", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.data.get("app", "OAUTH_PORT"));
    const result = await OAuth2Service.requestRemotePermissions(
      platformName,
      requestUri,
      clientHost,
      clientPort,
    );
    if (result["error"]) {
      const msg = result["error_reason"] + " - " + result["error_description"];
      throw this.user.log.error(msg, result);
    }
    if (result["state"] !== state) {
      const msg = "Response state does not match request state";
      throw this.user.log.error(msg, result);
    }
    if (!result["code"]) {
      const msg = "Remote response did not return a code";
      throw this.user.log.error(msg, result);
    }
    return result["code"] as string;
  }

  /**
   * Exchange remote code for tokens
   * @param appId
   * @param appSecret
   * @param code - the code to exchange
   * @param redirectUri
   * @returns - (short lived) access token
   */
  protected async exchangeCode(
    appId: string,
    appSecret: string,
    code: string,
    redirectUri: string,
  ): Promise<string> {
    this.user.log.trace("FacebookAuth", "exchangeCode");

    const tokens = (await this.get("oauth/access_token", {
      client_id: appId,
      client_secret: appSecret,
      code: code,
      redirect_uri: redirectUri,
    })) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw this.user.log.error(
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
    this.user.log.trace("FacebookAuth", "getLLPageToken");
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

    const pageData = data.data?.find((page) => page.id === pageId);
    if (!pageData) {
      throw this.user.log.error(
        "Page " + pageId + " is not listed in the Apps accounts.",
        data,
      );
    }
    const llPageAccessToken = pageData["access_token"];

    if (!llPageAccessToken) {
      throw this.user.log.error(
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
    this.user.log.trace("FacebookAuth", "getLLUserAccessToken");
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
      throw this.user.log.error(
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
    this.user.log.trace("FacebookAuth", "getAppUserId");
    const query = {
      fields: "id,name",
      access_token: accessToken,
    };
    const data = (await this.get("me", query)) as {
      id: string;
      name: string;
    };
    if (!data["id"]) {
      throw this.user.log.error("Can not get app scoped user id.", data);
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
    this.user.log.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
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

interface TokenResponse {
  access_token: string;
}

function isTokenResponse(tokens: TokenResponse) {
  try {
    assert("access_token" in tokens);
  } catch {
    return false;
  }
  return true;
}
