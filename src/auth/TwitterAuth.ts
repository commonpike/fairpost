import Logger from "../services/Logger";
import OAuth2Client from "./OAuth2Client";
import Storage from "../services/Storage";
import { TwitterApi } from "twitter-api-v2";

export default class TwitterAuth extends OAuth2Client {
  async setup() {
    const tokens = await this.requestAccessToken();
    Storage.set("auth", "TWITTER_ACCESS_TOKEN", tokens["accessToken"]);
    Storage.set("auth", "TWITTER_REFRESH_TOKEN", tokens["refreshToken"]);
  }

  protected async requestAccessToken(): Promise<{
    client: TwitterApi;
    scope: string[];
    accessToken: string;
    refreshToken?: string;
  }> {
    const client = new TwitterApi({
      clientId: Storage.get("settings", "TWITTER_CLIENT_ID"),
      clientSecret: Storage.get("settings", "TWITTER_CLIENT_SECRET"),
    });
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
      this.getCallbackUrl(),
      {
        scope: ["users.read", "tweet.read", "tweet.write", "offline.access"],
      },
    );

    const result = await this.requestRemotePermissions("Twitter", url);
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

    const tokens = await client.loginWithOAuth2({
      code: result["code"] as string,
      codeVerifier: codeVerifier,
      redirectUri: this.getCallbackUrl(),
    });
    if (!tokens["accessToken"]) {
      throw Logger.error("An accessToken was not returned");
    }

    return tokens;
  }
}
