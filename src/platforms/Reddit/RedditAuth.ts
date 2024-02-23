import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities";

import Logger from "../../services/Logger";
import OAuth2Service from "../../services/OAuth2Service";
import Storage from "../../services/Storage";
import User from "../../models/User";
import { strict as assert } from "assert";

export default class RedditAuth {
  API_VERSION = "v1";

  user: User;

  constructor(user: User) {
    this.user = user;
  }
  async setup() {
    const code = await this.requestCode();
    const tokens = await this.exchangeCode(code);
    this.store(tokens);
  }

  /**
   * Refresh Reddit Access token
   *
   * Reddits access token expire in 24 hours.
   * Refresh this regularly.
   */
  public async refresh() {
    const tokens = (await this.post("access_token", {
      grant_type: "refresh_token",
      refresh_token: Storage.get("auth", "REDDIT_REFRESH_TOKEN"),
    })) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw Logger.error(
        "RedditAuth.refresh: response is not a TokenResponse",
        tokens,
      );
    }
    this.store(tokens);
  }

  /**
   * Request remote code using OAuth2Service
   * @returns - code
   */
  protected async requestCode(): Promise<string> {
    Logger.trace("RedditAuth", "requestCode");
    const clientId = Storage.get("settings", "REDDIT_CLIENT_ID");
    const clientHost = Storage.get("settings", "REQUEST_HOSTNAME");
    const clientPort = Number(Storage.get("settings", "REQUEST_PORT"));
    const state = String(Math.random()).substring(2);

    // create auth url
    const url = new URL("https://www.reddit.com");
    url.pathname = "api/" + this.API_VERSION + "/authorize";
    const query = {
      client_id: clientId,
      redirect_uri: OAuth2Service.getCallbackUrl(clientHost, clientPort),
      state: state,
      response_type: "code",
      duration: "permanent",
      scope: ["identity", "submit"].join(),
    };
    url.search = new URLSearchParams(query).toString();

    const result = await OAuth2Service.requestRemotePermissions(
      "Reddit",
      url.href,
      clientHost,
      clientPort,
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
  protected async exchangeCode(code: string): Promise<TokenResponse> {
    Logger.trace("RedditAuth", "exchangeCode", code);
    const clientHost = Storage.get("settings", "REQUEST_HOSTNAME");
    const clientPort = Number(Storage.get("settings", "REQUEST_PORT"));
    const redirectUri = OAuth2Service.getCallbackUrl(clientHost, clientPort);

    const tokens = (await this.post("access_token", {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
    })) as {
      access_token: string;
      token_type: "bearer";
      expires_in: number;
      scope: string;
      refresh_token: string;
    };

    if (!isTokenResponse(tokens)) {
      throw Logger.error(
        "RedditAuth.exchangeCode: response is not a TokenResponse",
        tokens,
      );
    }

    return tokens;
  }

  /**
   * Save all tokens in auth store
   * @param tokens - the tokens to store
   */
  private store(tokens: TokenResponse) {
    Storage.set("auth", "REDDIT_ACCESS_TOKEN", tokens["access_token"]);
    const accessExpiry = new Date(
      new Date().getTime() + tokens["expires_in"] * 1000,
    ).toISOString();
    Storage.set("auth", "REDDIT_ACCESS_EXPIRY", accessExpiry);
    Storage.set("auth", "REDDIT_REFRESH_TOKEN", tokens["refresh_token"]);
    Storage.set("auth", "REDDIT_SCOPE", tokens["scope"]);
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
    const url = new URL("https://www.reddit.com");
    url.pathname = "api/" + this.API_VERSION + "/" + endpoint;
    Logger.trace("POST", url.href);

    const clientId = Storage.get("settings", "REDDIT_CLIENT_ID");
    const clientSecret = Storage.get("settings", "REDDIT_CLIENT_SECRET");
    const userpass = clientId + ":" + clientSecret;
    const userpassb64 = Buffer.from(userpass).toString("base64");

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + userpassb64,
      },
      body: new URLSearchParams(body),
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleRedditError(err))
      .catch((err) => handleApiError(err));
  }

  /**
   * Handle api error
   *
   * Improve error message and rethrow it.
   * @param error - ApiResponseError
   */
  private async handleRedditError(error: ApiResponseError): Promise<object> {
    // it appears the reddit oauth error
    // is standard - http code 4xx, carrying a message
    throw error;
  }
}

interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  scope: string;
  refresh_token: string;
}

function isTokenResponse(tokens: TokenResponse) {
  try {
    assert("access_token" in tokens);
    assert("expires_in" in tokens);
    assert("scope" in tokens);
    assert("refresh_token" in tokens);
  } catch (e) {
    return false;
  }
  return true;
}
