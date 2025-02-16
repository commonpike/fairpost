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
    await this.store(tokens);
  }

  /**
   * Refresh YouTube  tokens
   */
  async refresh() {
    this.user.trace("YouTubeAuth", "refresh");
    const auth = new OAuth2Client(
      this.user.get("app", "YOUTUBE_CLIENT_ID"),
      this.user.get("app", "YOUTUBE_CLIENT_SECRET"),
    );
    auth.setCredentials({
      access_token: this.user.get("auth", "YOUTUBE_ACCESS_TOKEN"),
      refresh_token: this.user.get("auth", "YOUTUBE_REFRESH_TOKEN"),
    });
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
      this.user.get("app", "YOUTUBE_CLIENT_ID"),
      this.user.get("app", "YOUTUBE_CLIENT_SECRET"),
    );
    auth.setCredentials({
      access_token: this.user.get("auth", "YOUTUBE_ACCESS_TOKEN"),
      refresh_token: this.user.get("auth", "YOUTUBE_REFRESH_TOKEN"),
    });
    auth.on("tokens", async (creds) => {
      this.user.trace("YouTubeAuth", "tokens event received");
      await this.store(creds);
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
    const clientHost = this.user.get("app", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.get("app", "OAUTH_PORT"));
    const state = String(Math.random()).substring(2);

    const auth = new OAuth2Client(
      this.user.get("app", "YOUTUBE_CLIENT_ID"),
      this.user.get("app", "YOUTUBE_CLIENT_SECRET"),
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
   * @returns - Credentials
   */
  private async exchangeCode(code: string): Promise<Credentials> {
    this.user.trace("YouTubeAuth", "exchangeCode", code);

    const clientHost = this.user.get("app", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.get("app", "OAUTH_PORT"));

    const auth = new OAuth2Client(
      this.user.get("app", "YOUTUBE_CLIENT_ID"),
      this.user.get("app", "YOUTUBE_CLIENT_SECRET"),
      OAuth2Service.getCallbackUrl(clientHost, clientPort),
    );

    const response = await auth.getToken(code);
    if (!isCredentials(response.tokens)) {
      throw this.user.error("Invalid response for getToken", response);
    }
    return response.tokens;
  }

  /**
   * Save all tokens in auth store
   * @param creds - contains the tokens to store
   */
  private async store(creds: Credentials) {
    this.user.trace("YouTubeAuth", "store");
    if (creds.access_token) {
      this.user.set("auth", "YOUTUBE_ACCESS_TOKEN", creds.access_token);
    }
    if (creds.expiry_date) {
      const accessExpiry = new Date(creds.expiry_date).toISOString();
      this.user.set("auth", "YOUTUBE_ACCESS_EXPIRY", accessExpiry);
    }
    if (creds.scope) {
      this.user.set("auth", "YOUTUBE_SCOPE", creds.scope);
    }
    if (creds.refresh_token) {
      this.user.set("auth", "YOUTUBE_REFRESH_TOKEN", creds.refresh_token);
    }
    await this.user.save();
  }
}

function isCredentials(creds: Credentials) {
  try {
    assert("access_token" in creds || "refresh_token" in creds);
  } catch (e) {
    return false;
  }
  return true;
}
