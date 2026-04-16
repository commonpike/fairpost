import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities.ts";

import { OAuthRequest, OAuthResponse } from "../../types/index.ts";
import OAuth2Service from "../../services/OAuth2Service.ts";
import User from "../../models/User.ts";
import { strict as assert } from "assert";

export default class LinkedInAuth {
  API_VERSION = "v2";

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
    const requestUrl = this.getRequestUrl(redirectUri, state);
    const code = await this.requestCliCode(redirectUri, requestUrl, state);

    // phase 2: exchange the code for tokens
    const tokens = await this.exchangeCode(code, redirectUri);
    await this.store(tokens);
  }

  /**
   * Connect LinkedIn platform via api
   *
   * OAuth basic flow is called in two phases:
   * - phase1 has redirect_uri and a state - will return a { url: string }
   * - phase2 has a code - will exchange for tokens and return { ready: true }
   * @param payload OAuthRequest
   * @returns OAuthResponse
   */
  async connectApi(payload: OAuthRequest): Promise<OAuthResponse> {
    if (payload.flow !== "basic") {
      throw this.user.log.error(
        "LinkedInAuth.connectApi: Payload flow must be basic",
        payload,
      );
    }
    if (payload.phase === "start") {
      if (!payload.redirect_uri) {
        throw this.user.log.error(
          "LinkedInAuth.connectApi: Payload:start missing redirect_uri",
          payload,
        );
      }
      return {
        phase: "start",
        flow: "basic",
        request_uri: this.getRequestUrl(payload.redirect_uri, payload.state),
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
          "LinkedInAuth.connectApi: Payload:finish missing code and/or redirect_uri",
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
    throw this.user.log.error("LinkedInAuth.connect: Unknown phase", payload);
  }

  /**
   * Get oauth2 url to request a code
   * @param redirectUri
   * @param state
   * @returns - string
   */
  private getRequestUrl(redirectUri: string, state?: string): string {
    const clientId = this.user.data.get("app", "LINKEDIN_CLIENT_ID");
    const url = new URL("https://www.linkedin.com");
    url.pathname = "oauth/" + this.API_VERSION + "/authorization";
    const query = {
      client_id: clientId,
      redirect_uri: redirectUri,
      ...(state ? { state: state } : {}),
      response_type: "code",
      duration: "permanent",
      scope: [
        "r_basicprofile",
        "w_member_social",
        "w_organization_social",
      ].join(" "),
    };
    url.search = new URLSearchParams(query).toString();
    return url.href;
  }

  /**
   * Request remote code using OAuth2Service as a local server
   * @param redirectUri
   * @param requestUrl
   * @param state
   * @returns - code
   */
  private async requestCliCode(
    redirectUri: string,
    requestUrl: string,
    state: string,
  ): Promise<string> {
    this.user.log.trace("LinkedInAuth", "requestCliCode");

    const result = await OAuth2Service.requestRemotePermissions(
      "LinkedIn",
      requestUrl,
      this.user.data.get("app", "OAUTH_HOSTNAME"),
      Number(this.user.data.get("app", "OAUTH_PORT")),
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
  private async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<TokenResponse> {
    this.user.log.trace("LinkedInAuth", "exchangeCode");
    const tokens = (await this.post("accessToken", {
      grant_type: "authorization_code",
      code: code,
      client_id: this.user.data.get("app", "LINKEDIN_CLIENT_ID"),
      client_secret: this.user.data.get("app", "LINKEDIN_CLIENT_SECRET"),
      redirect_uri: redirectUri,
    })) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw this.user.log.error("Invalid TokenResponse", tokens);
    }

    return tokens;
  }

  /**
   * Refresh LinkedIn  tokens
   */
  async refresh() {
    const tokens = (await this.post("accessToken", {
      grant_type: "refresh_token",
      refresh_token: this.user.data.get("auth", "LINKEDIN_REFRESH_TOKEN"),
      client_id: this.user.data.get("app", "LINKEDIN_CLIENT_ID"),
      client_secret: this.user.data.get("app", "LINKEDIN_CLIENT_SECRET"),
    })) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw this.user.log.error(
        "LinkedInAuth.refresh: response is not a TokenResponse",
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
    this.user.data.set("auth", "LINKEDIN_ACCESS_TOKEN", tokens["access_token"]);
    const accessExpiry = new Date(
      new Date().getTime() + tokens["expires_in"] * 1000,
    ).toISOString();
    this.user.data.set("auth", "LINKEDIN_ACCESS_EXPIRY", accessExpiry);

    this.user.data.set(
      "auth",
      "LINKEDIN_REFRESH_TOKEN",
      tokens["refresh_token"],
    );
    const refreshExpiry = new Date(
      new Date().getTime() + tokens["refresh_token_expires_in"] * 1000,
    ).toISOString();
    this.user.data.set("auth", "LINKEDIN_REFRESH_EXPIRY", refreshExpiry);

    this.user.data.set("auth", "LINKEDIN_SCOPE", tokens["scope"]);
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
    const url = new URL("https://www.linkedin.com");
    url.pathname = "oauth/" + this.API_VERSION + "/" + endpoint;
    this.user.log.trace("POST", url.href);

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
    })
      .then((res) => handleJsonResponse(res))
      .catch((err) => this.handleLinkedInError(err))
      .catch((err) => handleApiError(err, this.user));
  }

  /**
   * Handle api error
   *
   * Improve error message and rethrow it.
   * @param error - ApiResponseError
   */
  public async handleLinkedInError(error: ApiResponseError): Promise<never> {
    // it appears the linkedin oauth error
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
  refresh_token_expires_in: number;
}

function isTokenResponse(tokens: TokenResponse) {
  try {
    assert("access_token" in tokens);
    assert("expires_in" in tokens);
    assert("scope" in tokens);
    assert("refresh_token" in tokens);
    assert("refresh_token_expires_in" in tokens);
  } catch {
    return false;
  }
  return true;
}
