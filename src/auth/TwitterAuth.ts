import { TwitterApi } from "twitter-api-v2";

import OAuth2Client from "./OAuth2Client";
import Logger from "../core/Logger";
import Storage from "../core/Storage";

export default class TwitterAuth extends OAuth2Client {
  async setup() {
    const tokens = await this.requestAccessToken();
    Storage.set("auth", "TWITTER_ACCESS_TOKEN", tokens["accessToken"]);
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
      this.getRedirectUri(),
      {
        scope: ["users.read", "tweet.read", "tweet.write", "offline.access"],
      },
    );

    const result = await this.requestRemotePermissions("Twitter", url);
    if (result["error"]) {
      const msg = result["error_reason"] + " - " + result["error_description"];
      Logger.error(msg, result);
      throw new Error(msg);
    }
    if (result["state"] !== state) {
      const msg = "Response state does not match request state";
      Logger.error(msg, result);
      throw new Error(msg);
    }
    if (!result["code"]) {
      const msg = "Remote response did not return a code";
      Logger.error(msg, result);
      throw new Error(msg);
    }

    const tokens = await client.loginWithOAuth2({
      code: result["code"] as string,
      codeVerifier: codeVerifier,
      redirectUri: this.getRedirectUri(),
    });
    if (!tokens["accessToken"]) {
      throw new Error("An accessToken was not returned");
    }

    return tokens;
  }
}
