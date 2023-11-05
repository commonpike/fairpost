import OAuth2Client from "./OAuth2Client";
import Logger from "../core/Logger";
import Storage from "../core/Storage";

export default class RedditAuth extends OAuth2Client {
  API_VERSION = "v1";
  accessToken = "";

  async setup() {
    const code = await this.requestCode();
    const tokens = await this.exchangeCode(code);
    this.accessToken = tokens["access_token"];
    Storage.set("auth", "REDDIT_ACCESS_TOKEN", this.accessToken);
    Storage.set("auth", "REDDIT_REFRESH_TOKEN", tokens["refresh_token"]);
  }

  /**
   * Get Reddit Access token
   *
   * Reddits access token expire in 24 hours. Instead
   * of using an access token from the Storage, the Reddit
   * platform gets its token from here, which refreshes
   * it if needed using the refresh_token
   * @returns The access token
   */
  public async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }
    const result = await this.post("access_token", {
      grant_type: "refresh_token",
      refresh_token: Storage.get("settings", "REDDIT_REFRESH_TOKEN"),
    });

    if (!result["access_token"]) {
      const msg = "Remote response did not return a access_token";
      Logger.error(msg, result);
      throw new Error(msg);
    }
    this.accessToken = result["access_token"];
    return this.accessToken;
  }

  protected async requestCode(): Promise<string> {
    Logger.trace("RedditAuth", "requestCode");
    const clientId = Storage.get("settings", "REDDIT_CLIENT_ID");
    const state = String(Math.random()).substring(2);

    // create auth url
    const url = new URL("https://www.reddit.com");
    url.pathname = "api/" + this.API_VERSION + "/authorize";
    const query = {
      client_id: clientId,
      redirect_uri: this.getRedirectUri(),
      state: state,
      response_type: "code",
      duration: "permanent",
      scope: ["identity", "submit"].join(),
    };
    url.search = new URLSearchParams(query).toString();

    const result = await this.requestRemotePermissions("Reddit", url.href);
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
    return result["code"] as string;
  }

  protected async exchangeCode(code: string): Promise<{
    access_token: string;
    token_type: "bearer";
    expires_in: number;
    scope: string;
    refresh_token: string;
  }> {
    Logger.trace("RedditAuth", "exchangeCode", code);
    const redirectUri = this.getRedirectUri();

    const result = (await this.post("access_token", {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
    })) as {
      access_token: string;
      token_type: "bearer";
      expires_in: number;
      scope: string;
      refresh_token: string;
    };

    if (!result["access_token"]) {
      const msg = "Remote response did not return a access_token";
      Logger.error(msg, result);
      throw new Error(msg);
    }

    return result;
  }
  // API implementation -------------------

  /**
   * Do a FormData POST request on the graph.
   * @param endpoint - the path to call
   * @param body - body as object
   */

  private async post(
    endpoint: string,
    body: { [key: string]: string },
  ): Promise<object> {
    const url = new URL("https://www.reddit.com");
    url.pathname = "api/" + this.API_VERSION + "/" + endpoint;
    Logger.trace("POST", url.href);

    const clientId = Storage.get("settings", "REDDIT_CLIENT_ID");
    const clientSecret = Storage.get("settings", "REDDIT_CLIENT_SECRET");
    const userpass = clientId + ":" + clientSecret;
    const userpassb64 = Buffer.from(userpass).toString("base64");

    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + userpassb64,
      },
      body: new URLSearchParams(body),
    })
      .then((res) => this.handleApiResponse(res))
      .catch((err) => this.handleApiError(err));
  }

  /**
   * Handle api response
   * @param response - api response from fetch
   * @returns parsed object from response
   */
  private async handleApiResponse(response: Response): Promise<object> {
    if (!response.ok) {
      Logger.error("RedditAuth.handleApiResponse", "not ok");
      throw new Error(response.status + ":" + response.statusText);
    }
    const data = await response.json();
    if (data.error) {
      const error =
        response.status +
        ":" +
        data.error.type +
        "(" +
        data.error.code +
        "/" +
        data.error.error_subcode +
        ") " +
        data.error.message;
      Logger.error("RedditAuth.handleApiResponse", error);
      throw new Error(error);
    }
    Logger.trace("RedditAuth.handleApiResponse", "success");
    return data;
  }

  /**
   * Handle api error
   * @param error - the error returned from fetch
   */
  private handleApiError(error: Error): never {
    Logger.error("RedditAuth.handleApiError", error);
    throw error;
  }
}
