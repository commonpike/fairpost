import { auth } from "twitter-api-sdk";
import OAuth2Client from "./OAuth2Client";
import Logger from "../core/Logger";
import Storage from "../core/Storage";

export default class TwitterAuth extends OAuth2Client {
  async setup() {
    const accessToken = await this.requestAccessToken();
    Storage.set("auth", "TWITTER_ACCESS_TOKEN", accessToken);
  }

  protected async requestAccessToken(): Promise<string> {
    const authClient = new auth.OAuth2User({
      client_id: Storage.get("settings", "TWITTER_CLIENT_ID"),
      client_secret: Storage.get("settings", "TWITTER_CLIENT_SECRET"),
      callback: this.getRedirectUri(),
      scopes: ["tweet.read", "tweet.write", "offline.access"],
    });

    const state = String(Math.random()).substring(2);

    // create auth url
    const authUrl = authClient.generateAuthURL({
      state: state,
      code_challenge_method: "plain",
      code_challenge: "fairpssst",
    });

    const result = await this.requestRemotePermissions("Twitter", authUrl);
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

    const code = result["code"] as string;
    const accessToken = await authClient.requestAccessToken(code);
    /*
      token: {
        token_type: 'bearer',
        access_token: 'xxx',
        scope: 'tweet.write tweet.read offline.access',
        refresh_token: 'xxxx',
        expires_at: 1699017179875
      }
    */

    if (!accessToken.token?.access_token) {
      const msg = "Result does not contain access_token";
      Logger.error(msg, accessToken);
      throw new Error(msg);
    }

    return accessToken.token.access_token as string;
  }
}
