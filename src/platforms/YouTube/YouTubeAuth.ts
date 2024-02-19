import Logger from "../../services/Logger";
import { OAuth2Client } from "google-auth-library";
import OAuth2Service from "../../services/OAuth2Service";
import Storage from "../../services/Storage";
import { strict as assert } from "assert";
import { youtube_v3 } from "@googleapis/youtube";

export default class YouTubeAuth {
  client?: youtube_v3.Youtube;

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
    const auth = new OAuth2Client(
      Storage.get("settings", "YOUTUBE_CLIENT_ID"),
      Storage.get("settings", "YOUTUBE_CLIENT_SECRET"),
    );
    auth.setCredentials({
      refresh_token: Storage.get("auth", "YOUTUBE_REFRESH_TOKEN"),
    });
    const response = (await auth.getAccessToken()) as {
      res: { data: TokenResponse };
    };
    if (isTokenResponse(response["res"]["data"])) {
      this.store(response["res"]["data"]);
      return;
    }
    throw Logger.error("YouTubeAuth.refresh", "not a valid repsonse", response);
  }

  /**
   * Get or create a YouTube client
   * @returns - youtube_v3.Youtube
   */
  public getClient(): youtube_v3.Youtube {
    if (this.client) {
      return this.client;
    }
    const auth = new OAuth2Client();
    auth.setCredentials({
      access_token: Storage.get("auth", "YOUTUBE_ACCESS_TOKEN"),
    });
    this.client = new youtube_v3.Youtube({ auth });
    return this.client;
  }

  /**
   * Request remote code using OAuth2Service
   * @returns - code
   */
  private async requestCode(): Promise<string> {
    Logger.trace("YouTubeAuth", "requestCode");
    const state = String(Math.random()).substring(2);

    const auth = new OAuth2Client(
      Storage.get("settings", "YOUTUBE_CLIENT_ID"),
      Storage.get("settings", "YOUTUBE_CLIENT_SECRET"),
      OAuth2Service.getCallbackUrl(),
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

    const result = await OAuth2Service.requestRemotePermissions("YouTube", url);
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

    const auth = new OAuth2Client(
      Storage.get("settings", "YOUTUBE_CLIENT_ID"),
      Storage.get("settings", "YOUTUBE_CLIENT_SECRET"),
      OAuth2Service.getCallbackUrl(),
    );

    const response = (await auth.getToken(code)) as {
      tokens: TokenResponse;
    };
    if (!isTokenResponse(response.tokens)) {
      throw Logger.error("Invalid TokenResponse", response.tokens);
    }
    return response.tokens;
  }

  /**
   * Save all tokens in auth store
   * @param tokens - the tokens to store
   */
  private store(tokens: TokenResponse) {
    Storage.set("auth", "YOUTUBE_ACCESS_TOKEN", tokens["access_token"]);
    const accessExpiry = new Date(tokens["expiry_date"]).toISOString();
    Storage.set("auth", "YOUTUBE_ACCESS_EXPIRY", accessExpiry);
    if ("scope" in tokens) {
      Storage.set("auth", "YOUTUBE_SCOPE", tokens["scope"] ?? "");
    }
    if ("refresh_token" in tokens) {
      Storage.set(
        "auth",
        "YOUTUBE_REFRESH_TOKEN",
        tokens["refresh_token"] ?? "",
      );
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
