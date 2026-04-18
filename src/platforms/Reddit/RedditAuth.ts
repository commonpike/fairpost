import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities.ts";

import { OAuthRequest, OAuthResponse } from "../../types/index.ts";
import OAuth2Service from "../../services/OAuth2Service.ts";
import User from "../../models/User.ts";
import { strict as assert } from "assert";

export default class RedditAuth {
  API_VERSION = "v1";

  user: User;

  constructor(user: User) {
    this.user = user;
  }

  /**
   * Connect LinkedIn platform via cli
   */
  async connectCli() {
    // phase 1 : get the code
    const clientHost = this.user.data.get("app", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.data.get("app", "OAUTH_PORT"));
    const redirectUri = OAuth2Service.getCallbackUrl(clientHost, clientPort);
    const state = String(Math.random()).substring(2);
    const requestUri = this.getRequestUri(redirectUri, state);
    const code = await this.requestCliCode(requestUri, state);

    // phase 2: exchange the code for tokens
    const tokens = await this.exchangeCode(code, redirectUri);
    await this.store(tokens);
  }

  /**
   * Connect Reddit platform via api
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
        "RedditAuth.connectApi: Payload flow must be basic",
        payload,
      );
    }
    if (payload.phase === "start") {
      if (!payload.redirect_uri) {
        throw this.user.log.error(
          "RedditAuth.connectApi: Payload:start missing redirect_uri",
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
          "RedditAuth.connectApi: Payload:finish missing code and/or redirect_uri",
          payload,
        );
      }
      const tokens = await this.exchangeCode(
        payload.code,
        payload.redirect_uri,
      );
      await this.store(tokens);
      return {
        phase: "finish",
        flow: "basic",
        authenticated: true,
      };
    }
    throw this.user.log.error("RedditAuth.connect: Unknown phase", payload);
  }

  /**
   * Get oauth2 url to request a code
   * @param redirectUri
   * @param state
   * @returns - string
   */
  private getRequestUri(redirectUri: string, state?: string): string {
    const clientId = this.user.data.get("app", "REDDIT_CLIENT_ID");
    const url = new URL("https://www.reddit.com");
    url.pathname = "api/" + this.API_VERSION + "/authorize";
    const query = {
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state ?? "connect",
      response_type: "code",
      duration: "permanent",
      scope: ["identity", "submit"].join(),
    };
    url.search = new URLSearchParams(query).toString();
    return url.href;
  }

  /**
   * Request remote code using OAuth2Service as a local server
   * @param requestUri
   * @param state
   * @returns - code
   */
  private async requestCliCode(
    requestUri: string,
    state: string,
  ): Promise<string> {
    this.user.log.trace("RedditAuth", "requestCliCode");

    const clientHost = this.user.data.get("app", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.data.get("app", "OAUTH_PORT"));

    const result = await OAuth2Service.requestRemotePermissions(
      "Reddit",
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
   * Request remote code using OAuth2Service
   * @returns - code
   */
  protected async requestCode(): Promise<string> {
    this.user.log.trace("RedditAuth", "requestCode");
    const clientId = this.user.data.get("app", "REDDIT_CLIENT_ID");
    const clientHost = this.user.data.get("app", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.data.get("app", "OAUTH_PORT"));
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
   * @param code - the code to exchange
   * @param redirectUri
   * @returns - TokenResponse
   */
  protected async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<TokenResponse> {
    this.user.log.trace("RedditAuth", "exchangeCode", code);

    const tokens = (await this.post("access_token", {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
    })) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw this.user.log.error(
        "RedditAuth.exchangeCode: response is not a TokenResponse",
        tokens,
      );
    }

    return tokens;
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
      refresh_token: this.user.data.get("auth", "REDDIT_REFRESH_TOKEN"),
    })) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw this.user.log.error(
        "RedditAuth.refresh: response is not a TokenResponse",
        tokens,
      );
    }
    await this.store(tokens);
  }

  /**
   * Save all tokens in auth store
   * @param tokens - the tokens to store
   */
  private async store(tokens: TokenResponse) {
    this.user.data.set("auth", "REDDIT_ACCESS_TOKEN", tokens["access_token"]);
    const accessExpiry = new Date(
      new Date().getTime() + tokens["expires_in"] * 1000,
    ).toISOString();
    this.user.data.set("auth", "REDDIT_ACCESS_EXPIRY", accessExpiry);
    this.user.data.set("auth", "REDDIT_REFRESH_TOKEN", tokens["refresh_token"]);
    this.user.data.set("auth", "REDDIT_SCOPE", tokens["scope"]);
    await this.user.data.save();
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
    this.user.log.trace("POST", url.href);

    const clientId = this.user.data.get("app", "REDDIT_CLIENT_ID");
    const clientSecret = this.user.data.get("app", "REDDIT_CLIENT_SECRET");
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
      .catch((err) => handleApiError(err, this.user));
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
  } catch {
    return false;
  }
  return true;
}
