
import OAuth2Client from "./OAuth2Client";
import Logger from "../core/Logger";
import Storage from "../core/Storage";

export default class RedditAuth extends OAuth2Client {

    API_VERSION = 'v1';

    async setup() {
        const code = await this.requestCode();
        const tokens = await this.exchangeCode(code);
        Storage.set("auth", "REDDIT_ACCESS_TOKEN", tokens['access_token']);
    }

    protected async requestCode(): Promise<string> {

        const clientId = Storage.get("settings", "REDDIT_CLIENT_ID");
        const state = String(Math.random()).substring(2);

        // create auth url
        const url = new URL("https://www.reddit.com");
        url.pathname = "api/"+this.API_VERSION + "/authorize";
        const query = {
            client_id: clientId,
            redirect_uri: this.getRedirectUri(),
            state: state,
            response_type: "code",
            duration: "permanent",
            scope: [
                "identity",
                "submit"
            ].join(),
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

    protected async exchangeCode(
        code: string
        ): Promise<{
            access_token: string;
            token_type: "bearer";
            expires_in: number;
            scope: string;
            refresh_token: string;
          }> {
        const redirectUri = this.getRedirectUri();

        const result = await this.get("access_token", {
            code: code,
            redirect_uri: redirectUri,
        });

        if (!result["access_token"]) {
            const msg = "Remote response did not return a access_token";
            Logger.error(msg, result);
            throw new Error(msg);
        }

        return result["access_token"];
    }
    // API implementation -------------------

  /**
   * Do a GET request on the graph.
   * @param endpoint - the path to call
   * @param query - query string as object
   */

  private async get(
    endpoint: string,
    query: { [key: string]: string } = {},
  ): Promise<object> {
    const url = new URL("https://www.reddit.com");
    url.pathname = "api/"+this.API_VERSION + "/" + endpoint;
    url.search = new URLSearchParams(query).toString();
    const clientId = Storage.get('settings','REDDIT_CLIENT_ID');
    const clientSecret = Storage.get('settings','REDDIT_CLIENT_SECRET');
    Logger.trace("GET", url.href);
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: Buffer.from(clientId + ":" + clientSecret).toString('base64')

      },
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
      Logger.error("FacebookAuth.handleApiResponse", response);
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
      Logger.error("FacebookAuth.handleApiResponse", error);
      throw new Error(error);
    }
    Logger.trace("FacebookAuth.handleApiResponse", "success");
    return data;
  }

  /**
   * Handle api error
   * @param error - the error returned from fetch
   */
  private handleApiError(error: Error): never {
    Logger.error("FacebookAuth.handleApiError", error);
    throw error;
  }
}
