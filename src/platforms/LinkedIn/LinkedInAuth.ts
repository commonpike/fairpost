import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities";

import OAuth2Service from "../../services/OAuth2Service";
import User from "../../models/User";
import { strict as assert } from "assert";

export default class LinkedInAuth {
  API_VERSION = "v2";

  user: User;

  constructor(user: User) {
    this.user = user;
  }

  /**
   * Set up LinkedIn platform
   */
  async setup() {
    const code = await this.requestCode();
    const tokens = await this.exchangeCode(code);
    this.store(tokens);
  }

  /**
   * Refresh LinkedIn  tokens
   */
  async refresh() {
    const tokens = (await this.post("accessToken", {
      grant_type: "refresh_token",
      refresh_token: this.user.get("auth", "LINKEDIN_REFRESH_TOKEN"),
      client_id: this.user.get("app", "LINKEDIN_CLIENT_ID"),
      client_secret: this.user.get("app", "LINKEDIN_CLIENT_SECRET"),
    })) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw this.user.error(
        "LinkedInAuth.refresh: response is not a TokenResponse",
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
    this.user.trace("LinkedInAuth", "requestCode");
    const clientId = this.user.get("app", "LINKEDIN_CLIENT_ID");
    const clientHost = this.user.get("app", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.get("app", "OAUTH_PORT"));
    const state = String(Math.random()).substring(2);

    // create auth url
    const url = new URL("https://www.linkedin.com");
    url.pathname = "oauth/" + this.API_VERSION + "/authorization";
    const query = {
      client_id: clientId,
      redirect_uri: OAuth2Service.getCallbackUrl(clientHost, clientPort),
      state: state,
      response_type: "code",
      duration: "permanent",
      scope: [
        "r_basicprofile",
        "w_member_social",
        "w_organization_social",
      ].join(" "),
    };
    url.search = new URLSearchParams(query).toString();

    const result = await OAuth2Service.requestRemotePermissions(
      "LinkedIn",
      url.href,
      clientHost,
      clientPort,
    );
    if (result["error"]) {
      const msg = result["error_reason"] + " - " + result["error_description"];
      throw this.user.error(msg, result);
    }
    if (result["state"] !== state) {
      const msg = "Response state does not match request state";
      throw this.user.error(msg, result);
    }
    if (!result["code"]) {
      const msg = "Remote response did not return a code";
      throw this.user.error(msg, result);
    }
    return result["code"] as string;
  }

  /**
   * Exchange remote code for tokens
   * @param code - the code to exchange
   * @returns - TokenResponse
   */
  private async exchangeCode(code: string): Promise<TokenResponse> {
    this.user.trace("LinkedInAuth", "exchangeCode", code);
    const clientHost = this.user.get("app", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.get("app", "OAUTH_PORT"));
    const redirectUri = OAuth2Service.getCallbackUrl(clientHost, clientPort);

    const tokens = (await this.post("accessToken", {
      grant_type: "authorization_code",
      code: code,
      client_id: this.user.get("app", "LINKEDIN_CLIENT_ID"),
      client_secret: this.user.get("app", "LINKEDIN_CLIENT_SECRET"),
      redirect_uri: redirectUri,
    })) as TokenResponse;

    if (!isTokenResponse(tokens)) {
      throw this.user.error("Invalid TokenResponse", tokens);
    }

    return tokens;
  }

  /**
   * Save all tokens in auth store
   * @param tokens - the tokens to store
   */
  private store(tokens: TokenResponse) {
    this.user.set("auth", "LINKEDIN_ACCESS_TOKEN", tokens["access_token"]);
    const accessExpiry = new Date(
      new Date().getTime() + tokens["expires_in"] * 1000,
    ).toISOString();
    this.user.set("auth", "LINKEDIN_ACCESS_EXPIRY", accessExpiry);

    this.user.set("auth", "LINKEDIN_REFRESH_TOKEN", tokens["refresh_token"]);
    const refreshExpiry = new Date(
      new Date().getTime() + tokens["refresh_token_expires_in"] * 1000,
    ).toISOString();
    this.user.set("auth", "LINKEDIN_REFRESH_EXPIRY", refreshExpiry);

    this.user.set("auth", "LINKEDIN_SCOPE", tokens["scope"]);
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
    this.user.trace("POST", url.href);

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
  } catch (e) {
    return false;
  }
  return true;
}
