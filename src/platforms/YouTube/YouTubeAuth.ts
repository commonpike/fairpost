import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities";

import Logger from "../../services/Logger";
import OAuth2Service from "../../services/OAuth2Service";
import Storage from "../../services/Storage";
import { strict as assert } from "assert";

export default class YouTubeAuth {
  API_VERSION = "v2";

  /**
   * Set up YouTube platform
   */
  async setup() {
    const code = await this.requestCode();
    const tokens = await this.exchangeCode(code);
    this.store(tokens);
  }

  /**
   * Refresh YouTube  tokens
   */
  async refresh() {
    const tokens = (await this.post("token", {
      grant_type: "refresh_token",
      refresh_token: Storage.get("auth", "YOUTUBE_REFRESH_TOKEN"),
      client_id: Storage.get("settings", "YOUTUBE_CLIENT_ID"),
      client_secret: Storage.get("settings", "YOUTUBE_CLIENT_SECRET"),
    })) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw Logger.error(
        "YouTubeAuth.refresh: response is not a TokenResponse",
        tokens,
      );
    }
    this.store(tokens);
  }

  /**
   * Request remote code using OAuth2Service
   * @returns - code
   */
  private async requestCode(): Promise<string> {
    Logger.trace("YouTubeAuth", "requestCode");
    const clientId = Storage.get("settings", "YOUTUBE_CLIENT_ID");
    const state = String(Math.random()).substring(2);

    // create auth url
    const url = new URL("https://accounts.google.com");
    url.pathname = "o/oauth2/" + this.API_VERSION + "/auth";
    const query = {
      client_id: clientId,
      redirect_uri: OAuth2Service.getCallbackUrl(),
      state: state,
      response_type: "code",
      duration: "permanent",
      scope: [
        "https://www.googleapis.com/auth/youtube.force-ssl",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.upload",
      ].join(" "),
    };
    url.search = new URLSearchParams(query).toString();

    const result = await OAuth2Service.requestRemotePermissions(
      "YouTube",
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

  /**
   * Exchange remote code for tokens
   * @param code - the code to exchange
   * @returns - TokenResponse
   */
  private async exchangeCode(code: string): Promise<TokenResponse> {
    Logger.trace("YouTubeAuth", "exchangeCode", code);
    const redirectUri = OAuth2Service.getCallbackUrl();

    const tokens = (await this.post("token", {
      grant_type: "authorization_code",
      code: code,
      client_id: Storage.get("settings", "YOUTUBE_CLIENT_ID"),
      client_secret: Storage.get("settings", "YOUTUBE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
    })) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw Logger.error("Invalid TokenResponse", tokens);
    }

    return tokens;
  }

  /**
   * Save all tokens in auth store
   * @param tokens - the tokens to store
   */
  private store(tokens: TokenResponse) {
    Storage.set("auth", "YOUTUBE_ACCESS_TOKEN", tokens["access_token"]);
    const accessExpiry = new Date(
      new Date().getTime() + tokens["expires_in"] * 1000,
    ).toISOString();
    Storage.set("auth", "YOUTUBE_ACCESS_EXPIRY", accessExpiry);
    Storage.set("auth", "YOUTUBE_SCOPE", tokens["scope"]);
    if ("refresh_token" in tokens) {
      Storage.set(
        "auth",
        "YOUTUBE_REFRESH_TOKEN",
        tokens["refresh_token"] ?? "",
      );
    }
  }

  // API implementation -------------------

  /**
   * Do a url-encoded POST request on the api.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  private async post(
    endpoint: string,
    body: { [key: string]: string },
  ): Promise<object> {
    const url = new URL("https://oauth2.googleapis.com");
    url.pathname = endpoint;
    Logger.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleYouTubeError(err))
      .catch((err) => handleApiError(err));
  }

  /**
   * Handle api error
   *
   * Improve error message and rethrow it.
   * @param error - ApiResponseError
   */
  public async handleYouTubeError(error: ApiResponseError): Promise<never> {
    throw error;
  }
}

interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

function isTokenResponse(tokens: TokenResponse) {
  try {
    assert("access_token" in tokens);
    assert("expires_in" in tokens);
    assert("scope" in tokens);
  } catch (e) {
    return false;
  }
  return true;
}
