import FacebookAuth from "../Facebook/FacebookAuth.ts";
import { OAuthRequest, OAuthResponse } from "../../types/index.ts";
import OAuth2Service from "../../services/OAuth2Service.ts";
import User from "../../models/User.ts";

export default class InstagramAuth extends FacebookAuth {
  constructor(user: User) {
    super(user);
  }

  /**
   * Connect Instagram platform via cli
   * Inherits most methods from FacebookAuth
   */
  async connectCli() {
    // phase 1 : get the code
    const clientHost = this.user.data.get("app", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.data.get("app", "OAUTH_PORT"));
    const redirectUri = OAuth2Service.getCallbackUrl(clientHost, clientPort);
    const state = String(Math.random()).substring(2);
    const requestUri = this.getRequestUri(redirectUri, state);
    const code = await this.requestCliCode("Instagram", requestUri, state);

    // phase 2: exchange the code for tokens
    const appId = this.user.data.get("app", "INSTAGRAM_APP_ID");
    const appSecret = this.user.data.get("app", "INSTAGRAM_APP_SECRET");
    const accessToken = await this.exchangeCode(
      appId,
      appSecret,
      code,
      redirectUri,
    );
    const pageToken = await this.getLLPageToken(
      appId,
      appSecret,
      this.user.data.get("settings", "INSTAGRAM_PAGE_ID"),
      accessToken,
    );

    this.user.data.set("auth", "INSTAGRAM_PAGE_ACCESS_TOKEN", pageToken);
    await this.user.data.save();
  }

  /**
   * Connect Instagram platform via api
   * Inherits most methods from FacebookAuth
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
        "FacebookAuth.connectApi: Payload flow must be basic",
        payload,
      );
    }
    if (payload.phase === "start") {
      if (!payload.redirect_uri) {
        throw this.user.log.error(
          "FacebookAuth.connectApi: Payload:start missing redirect_uri",
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
          "FacebookAuth.connectApi: Payload:finish missing code and/or redirect_uri",
          payload,
        );
      }
      const appId = this.user.data.get("app", "INSTAGRAM_APP_ID");
      const appSecret = this.user.data.get("app", "INSTAGRAM_APP_SECRET");
      const accessToken = await this.exchangeCode(
        appId,
        appSecret,
        payload.code,
        payload.redirect_uri,
      );
      const pageToken = await this.getLLPageToken(
        appId,
        appSecret,
        this.user.data.get("settings", "INSTAGRAM_PAGE_ID"),
        accessToken,
      );
      this.user.data.set("auth", "INSTAGRAM_PAGE_ACCESS_TOKEN", pageToken);
      await this.user.data.save();

      return {
        phase: "finish",
        flow: "basic",
        authenticated: true,
      };
    }
    throw this.user.log.error("InstagramAuth.connect: Unknown phase", payload);
  }
}
