import FacebookAuth from "./FacebookAuth";
import Logger from "../core/Logger";
import Storage from "../core/Storage";

export default class InstagramAuth extends FacebookAuth {
  async setup() {
    const code = await this.requestCode(
      Storage.get("settings", "INSTAGRAM_APP_ID"),
    );

    const accessToken = await this.exchangeCode(
      code,
      Storage.get("settings", "INSTAGRAM_APP_ID"),
      Storage.get("settings", "INSTAGRAM_APP_SECRET"),
    );

    const pageToken = await this.getLLPageToken(
      Storage.get("settings", "INSTAGRAM_APP_ID"),
      Storage.get("settings", "INSTAGRAM_APP_SECRET"),
      Storage.get("settings", "INSTAGRAM_PAGE_ID"),
      accessToken,
    );

    Storage.set("auth", "INSTAGRAM_PAGE_ACCESS_TOKEN", pageToken);
  }

  protected async requestCode(clientId: string): Promise<string> {
    const host = Storage.get("settings", "CLIENT_HOSTNAME");
    const port = Number(Storage.get("settings", "CLIENT_PORT"));
    const state = String(Math.random());

    // create auth url
    const url = new URL("https://www.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/dialog/oauth";
    const query = {
      client_id: clientId,
      redirect_uri: "{{redirectUri}}", // super() will handle this
      state: state,
      response_type: "code",
      scope: [
        "pages_manage_engagement",
        "pages_manage_posts",
        "pages_read_engagement",
        //'pages_read_user_engagement',
        "publish_video",
        "business_management",
        "instagram_basic",
        "instagram_content_publish",
      ].join(),
    };
    url.search = new URLSearchParams(query).toString();

    const result = await this.requestRemotePermissions(
      "Instagram",
      url.href,
      host,
      port,
    );
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
}
