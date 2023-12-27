import Logger from "../../services/Logger";
import OAuth2Service from "../../services/OAuth2Service";
import Storage from "../../services/Storage";
import { TwitterApi } from "twitter-api-v2";
import { strict as assert } from "assert";

export default class TwitterAuth extends OAuth2Service {
  client?: TwitterApi;

  /**
   * Set up Twitter platform
   */
  async setup() {
    const { code, verifier } = await this.requestCode();
    const tokens = await this.exchangeCode(code, verifier);
    this.store(tokens);
  }

  /**
   * Refresh Twitter tokens
   */
  async refresh() {
    const tokens = (await this.getClient().refreshOAuth2Token(
      Storage.get("auth", "TWITTER_REFRESH_TOKEN"),
    )) as TokenResponse;
    if (!isTokenResponse(tokens)) {
      throw Logger.error(
        "TwitterAuth.refresh: response is not a TokenResponse",
        tokens,
      );
    }
    this.store(tokens);
  }

  /**
   * Get or create a TwitterApi client
   * @returns - TwitterApi
   */
  private getClient(): TwitterApi {
    if (this.client) {
      return this.client;
    }
    this.client = new TwitterApi({
      clientId: Storage.get("settings", "TWITTER_CLIENT_ID"),
      clientSecret: Storage.get("settings", "TWITTER_CLIENT_SECRET"),
    });
    return this.client;
  }

  /**
   * Request remote code using OAuth2Service
   * @returns - {code, verifier}
   */
  private async requestCode(): Promise<{ code: string; verifier: string }> {
    const { url, codeVerifier, state } =
      this.getClient().generateOAuth2AuthLink(OAuth2Service.getCallbackUrl(), {
        scope: ["users.read", "tweet.read", "tweet.write", "offline.access"],
      });
    const result = await OAuth2Service.requestRemotePermissions("Twitter", url);
    if (result["error"]) {
      const msg = result["error_reason"] + " - " + result["error_description"];
      throw Logger.error("TwitterApi.requestCode: " + msg, result);
    }
    if (result["state"] !== state) {
      const msg = "Response state does not match request state";
      throw Logger.error("TwitterApi.requestCode: " + msg, result);
    }
    if (!result["code"]) {
      const msg = "Remote response did not return a code";
      throw Logger.error("TwitterApi.requestCode: " + msg, result);
    }
    return {
      code: result["code"] as string,
      verifier: codeVerifier,
    };
  }

  /**
   * Exchange remote code for tokens
   * @param code - the code to exchange
   * @param verifier - the code verifier to use
   * @returns - TokenResponse
   */
  private async exchangeCode(
    code: string,
    verifier: string,
  ): Promise<TokenResponse> {
    const tokens = (await this.getClient().loginWithOAuth2({
      code: code,
      codeVerifier: verifier,
      redirectUri: OAuth2Service.getCallbackUrl(),
    })) as TokenResponse;
    if (!isTokenResponse(tokens)) {
      throw Logger.error(
        "TitterAuth.requestAccessToken: reponse is not a valid TokenResponse",
      );
    }

    return tokens;
  }

  /**
   * Save all tokens in auth store
   * @param tokens - the tokens to store
   */
  private store(tokens: TokenResponse) {
    Storage.set("auth", "TWITTER_ACCESS_TOKEN", tokens["accessToken"]);
    const accessExpiry = new Date(
      new Date().getTime() + tokens["expiresIn"] * 1000,
    ).toISOString();
    Storage.set("auth", "TWITTER_ACCESS_EXPIRY", accessExpiry);

    Storage.set("auth", "TWITTER_REFRESH_TOKEN", tokens["refreshToken"]);
  }
}

interface TokenResponse {
  client: TwitterApi;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

function isTokenResponse(tokens: TokenResponse) {
  try {
    assert("accessToken" in tokens);
    assert("expiresIn" in tokens);
    assert("refreshToken" in tokens);
  } catch (e) {
    return false;
  }
  return true;
}
