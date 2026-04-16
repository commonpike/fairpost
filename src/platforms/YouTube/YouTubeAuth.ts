import { Credentials, OAuth2Client } from "google-auth-library";

import { OAuthRequest, OAuthResponse } from "../../types/index.ts";
import OAuth2Service from "../../services/OAuth2Service.ts";
import User from "../../models/User.ts";
import { strict as assert } from "assert";
import { youtube_v3 } from "@googleapis/youtube";

export default class YouTubeAuth {
  client?: youtube_v3.Youtube;

  user: User;

  constructor(user: User) {
    this.user = user;
  }

  /**
   * Connect Youtube platform via cli
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
   * Connect LinkedIn platform via api
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
        "YouTubeAuth.connectApi: Payload flow must be basic",
        payload,
      );
    }
    if (payload.phase === "start") {
      if (!payload.redirect_uri) {
        throw this.user.log.error(
          "YouTubeAuth.connectApi: Payload:start missing redirect_uri",
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
          "YouTubeAuth.connectApi: Payload:finish missing code and/or redirect_uri",
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
    throw this.user.log.error("YouTubeAuth.connect: Unknown phase", payload);
  }

  /**
   * Get oauth2 url to request a code
   * @param redirectUri
   * @param state
   * @returns string
   */
  private getRequestUri(redirectUri: string, state?: string): string {
    const auth = new OAuth2Client(
      this.user.data.get("app", "YOUTUBE_CLIENT_ID"),
      this.user.data.get("app", "YOUTUBE_CLIENT_SECRET"),
      redirectUri,
    );
    return auth.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/youtube.force-ssl",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.upload",
      ],
      state: state,
    });
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
    this.user.log.trace("YouTubeAuth", "requestCliCode");

    const clientHost = this.user.data.get("app", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.data.get("app", "OAUTH_PORT"));

    const result = await OAuth2Service.requestRemotePermissions(
      "YouTube",
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
   * @param code - the code to exchange
   * @param redirectUri
   * @returns - Credentials
   */
  private async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<Credentials> {
    this.user.log.trace("YouTubeAuth", "exchangeCode", code);

    const auth = new OAuth2Client(
      this.user.data.get("app", "YOUTUBE_CLIENT_ID"),
      this.user.data.get("app", "YOUTUBE_CLIENT_SECRET"),
      redirectUri,
    );

    const response = await auth.getToken(code);
    if (!isCredentials(response.tokens)) {
      throw this.user.log.error("Invalid response for getToken", response);
    }
    return response.tokens;
  }

  /**
   * Refresh YouTube  tokens
   */
  async refresh() {
    this.user.log.trace("YouTubeAuth", "refresh");
    const auth = new OAuth2Client(
      this.user.data.get("app", "YOUTUBE_CLIENT_ID"),
      this.user.data.get("app", "YOUTUBE_CLIENT_SECRET"),
    );
    auth.setCredentials({
      access_token: this.user.data.get("auth", "YOUTUBE_ACCESS_TOKEN"),
      refresh_token: this.user.data.get("auth", "YOUTUBE_REFRESH_TOKEN"),
    });
    // perhaps check if refresh is needed soon ?
    const response = (await auth.refreshAccessToken()) as {
      res?: { data: Credentials };
      credentials?: Credentials;
    };
    if (response["res"]?.["data"] && isCredentials(response["res"]["data"])) {
      await this.store(response["res"]["data"]);
      return;
    } else if (response.credentials) {
      await this.store(response.credentials);
      return;
    }
    throw this.user.log.error(
      "YouTubeAuth.refresh",
      "not a valid response",
      response,
    );
  }

  /**
   * Get or create a YouTube client
   * @returns - youtube_v3.Youtube
   */
  public getClient(): youtube_v3.Youtube {
    if (this.client) {
      return this.client;
    }
    const auth = new OAuth2Client(
      this.user.data.get("app", "YOUTUBE_CLIENT_ID"),
      this.user.data.get("app", "YOUTUBE_CLIENT_SECRET"),
    );
    auth.setCredentials({
      access_token: this.user.data.get("auth", "YOUTUBE_ACCESS_TOKEN"),
      refresh_token: this.user.data.get("auth", "YOUTUBE_REFRESH_TOKEN"),
    });
    auth.on("tokens", async (creds) => {
      this.user.log.trace("YouTubeAuth", "tokens event received");
      await this.store(creds);
    });
    this.client = new youtube_v3.Youtube({ auth });
    return this.client;
  }

  /**
   * Save all tokens in auth store
   * @param creds - contains the tokens to store
   */
  private async store(creds: Credentials) {
    this.user.log.trace("YouTubeAuth", "store");
    if (creds.access_token) {
      this.user.data.set("auth", "YOUTUBE_ACCESS_TOKEN", creds.access_token);
    }
    if (creds.expiry_date) {
      const accessExpiry = new Date(creds.expiry_date).toISOString();
      this.user.data.set("auth", "YOUTUBE_ACCESS_EXPIRY", accessExpiry);
    }
    if (creds.scope) {
      this.user.data.set("auth", "YOUTUBE_SCOPE", creds.scope);
    }
    if (creds.refresh_token) {
      this.user.data.set("auth", "YOUTUBE_REFRESH_TOKEN", creds.refresh_token);
    }
    await this.user.data.save();
  }
}

function isCredentials(creds: Credentials) {
  try {
    assert("access_token" in creds || "refresh_token" in creds);
  } catch {
    return false;
  }
  return true;
}
