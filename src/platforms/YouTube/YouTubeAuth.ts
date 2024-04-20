import { Credentials, OAuth2Client } from "google-auth-library";

import OAuth2Service from "../../services/OAuth2Service";
import User from "../../models/User";
import { strict as assert } from "assert";
import { youtube_v3 } from "@googleapis/youtube";

export default class YouTubeAuth {
  client?: youtube_v3.Youtube;

  user: User;

  constructor(user: User) {
    this.user = user;
  }

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
    this.user.trace("YouTubeAuth", "refresh");
    const auth = new OAuth2Client(
      this.user.get("settings", "YOUTUBE_CLIENT_ID"),
      this.user.get("settings", "YOUTUBE_CLIENT_SECRET"),
    );
    auth.setCredentials({
      access_token: this.user.get("auth", "YOUTUBE_ACCESS_TOKEN"),
      refresh_token: this.user.get("auth", "YOUTUBE_REFRESH_TOKEN"),
    });
    const response = (await auth.refreshAccessToken()) as {
      res?: { data: TokenResponse };
      credentials?: Credentials;
    };
    if (response["res"]?.["data"] && isTokenResponse(response["res"]["data"])) {
      this.store(response["res"]["data"]);
      return;
    } else if (response.credentials) {
      this.update(response.credentials);
      return;
    }
    throw this.user.error(
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
      this.user.get("settings", "YOUTUBE_CLIENT_ID"),
      this.user.get("settings", "YOUTUBE_CLIENT_SECRET"),
    );
    auth.setCredentials({
      access_token: this.user.get("auth", "YOUTUBE_ACCESS_TOKEN"),
      refresh_token: this.user.get("auth", "YOUTUBE_REFRESH_TOKEN"),
    });
    auth.on("tokens", (creds) => {
      this.update(creds);
    });
    this.client = new youtube_v3.Youtube({ auth });
    return this.client;
  }

  /**
   * Request remote code using OAuth2Service
   * @returns - code
   */
  private async requestCode(): Promise<string> {
    this.user.trace("YouTubeAuth", "requestCode");
    const clientHost = this.user.get("settings", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.get("settings", "OAUTH_PORT"));
    const state = String(Math.random()).substring(2);

    const auth = new OAuth2Client(
      this.user.get("settings", "YOUTUBE_CLIENT_ID"),
      this.user.get("settings", "YOUTUBE_CLIENT_SECRET"),
      OAuth2Service.getCallbackUrl(clientHost, clientPort),
    );
    const url = auth.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/youtube.force-ssl",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.upload",
      ],
      state: state,
    });

    const result = await OAuth2Service.requestRemotePermissions(
      "YouTube",
      url,
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
    this.user.trace("YouTubeAuth", "exchangeCode", code);

    const clientHost = this.user.get("settings", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.get("settings", "OAUTH_PORT"));

    const auth = new OAuth2Client(
      this.user.get("settings", "YOUTUBE_CLIENT_ID"),
      this.user.get("settings", "YOUTUBE_CLIENT_SECRET"),
      OAuth2Service.getCallbackUrl(clientHost, clientPort),
    );

    const response = (await auth.getToken(code)) as {
      tokens: TokenResponse;
    };
    if (!isTokenResponse(response.tokens)) {
      throw this.user.error("Invalid TokenResponse", response.tokens);
    }
    return response.tokens;
  }

  /**
   * Save all tokens in auth store
   * @param tokens - the tokens to store
   */
  private store(tokens: TokenResponse) {
    this.user.set("auth", "YOUTUBE_ACCESS_TOKEN", tokens["access_token"]);
    const accessExpiry = new Date(tokens["expiry_date"]).toISOString();
    this.user.set("auth", "YOUTUBE_ACCESS_EXPIRY", accessExpiry);
    if ("scope" in tokens) {
      this.user.set("auth", "YOUTUBE_SCOPE", tokens["scope"] ?? "");
    }
    if ("refresh_token" in tokens) {
      this.user.set(
        "auth",
        "YOUTUBE_REFRESH_TOKEN",
        tokens["refresh_token"] ?? "",
      );
    }
  }
  /**
   * Save all credentials in auth store;
   * this is called from the 'tokens' event on the client
   * @param creds - google.oauth2.credentials
   */
  private update(creds: Credentials) {
    this.user.trace("YouTubeAuth", "update", creds);
    if ("access_token" in creds && creds.access_token) {
      this.user.set("auth", "YOUTUBE_ACCESS_TOKEN", creds["access_token"]);
    }
    // we can not see the expiry date from the credentials,
    // and since we have the 'tokens' event it gets irrelevant ..
    const accessExpiry = new Date(0);
    this.user.set("auth", "YOUTUBE_ACCESS_EXPIRY", accessExpiry.toISOString());
    if ("refresh_token" in creds && creds.refresh_token) {
      this.user.set("auth", "YOUTUBE_REFRESH_TOKEN", creds["refresh_token"]);
    }
  }
}

interface TokenResponse {
  access_token: string;
  token_type?: "bearer";
  expiry_date: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

function isTokenResponse(tokens: TokenResponse) {
  try {
    assert("access_token" in tokens);
    assert("expiry_date" in tokens);
  } catch (e) {
    return false;
  }
  return true;
}
