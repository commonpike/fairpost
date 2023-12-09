import FacebookAuth from "../Facebook/FacebookAuth";
import Logger from "../../services/Logger";
import OAuth2Service from "../../services/OAuth2Service";
import Storage from "../../services/Storage";

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
    const state = String(Math.random()).substring(2);

    // create auth url
    const url = new URL("https://www.facebook.com");
    url.pathname = this.GRAPH_API_VERSION + "/dialog/oauth";
    const query = {
      client_id: clientId,
      redirect_uri: OAuth2Service.getCallbackUrl(),
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

    const result = await OAuth2Service.requestRemotePermissions(
      "Instagram",
      url.href,
    );

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
}
