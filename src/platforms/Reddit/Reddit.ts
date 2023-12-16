import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

import Post, { PostStatus } from "../../models/Post";

import Folder from "../../models/Folder";
import Logger from "../../services/Logger";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import RedditApi from "./RedditApi";
import RedditAuth from "./RedditAuth";
import Storage from "../../services/Storage";
import { XMLParser } from "fast-xml-parser";

/**
 * Reddit: support for reddit platform
 */
export default class Reddit extends Platform {
  id = PlatformId.REDDIT;

  SUBREDDIT: string;
  api: RedditApi;
  auth: RedditAuth;

  constructor() {
    super();
    this.SUBREDDIT = Storage.get("settings", "REDDIT_SUBREDDIT", "");
    this.api = new RedditApi();
    this.auth = new RedditAuth();
  }

  /** @inheritdoc */
  async setup() {
    return await this.auth.setup();
  }

  /** @inheritdoc */
  async test() {
    const me = await this.api.get("me");
    if (!me) return false;
    return {
      id: me["id"],
      name: me["name"],
    };
  }

  /** @inheritdoc */
  async refresh(): Promise<boolean> {
    await this.auth.refresh();
    return true;
  }

  async preparePost(folder: Folder): Promise<Post | undefined> {
    Logger.trace("Reddit.preparePost", folder.id);
    const post = await super.preparePost(folder);
    if (post) {
      // reddit: max 1 image or video
      // TODO: extract video thumbnail
      if (post.files.video.length >= 1) { // eslint-disable-line
        post.files.video.length = 1;
        post.files.image = [];
      } else if (post.files.image.length > 1) {
        // <MaxSizeAllowed>20971520</MaxSizeAllowed>
        const src = post.files.image[0];
        const metadata = await sharp(post.getFullPath(src)).metadata();
        if (metadata.width > 3000) {
          Logger.trace("Resizing " + src + " for reddit ..");
          const extension = src.split(".")?.pop();
          const basename = path.basename(src, extension ? "." + extension : "");
          const dst = this.assetsFolder() + "/reddit-" + basename + ".jpg";
          await sharp(post.getFullPath(src))
            .resize({
              width: 3000,
            })
            .toFile(post.getFullPath(dst));
          post.files.image = [dst];
        }
      }
      post.save();
    }
    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("Reddit.publishPost", post.id, dryrun);

    let response = dryrun ? { dryrun: true } : {};
    let error = undefined;

    try {
      if (post.files.video.length) {
        response = await this.publishVideo(
          post.title,
          post.folder.path + "/" + post.files.video[0],
          dryrun,
        );
      } else if (post.files.image.length) {
        response = await this.publishImage(
          post.title,
          post.folder.path + "/" + post.files.image[0],
          dryrun,
        );
      } else {
        response = await this.publishText(post.title, post.body, dryrun);
      }
    } catch (e) {
      error = e;
    }

    post.results.push({
      date: new Date(),
      dryrun: dryrun,
      success: !error,
      error: error,
      response: response,
    });

    if (error) {
      Logger.warn("Reddit.publishPost", this.id, "failed", response);
    } else if (!dryrun) {
      // post.link = ""; // todo : await reddit websockets
      post.status = PostStatus.PUBLISHED;
      post.published = new Date();
    }

    post.save();
    return !error;
  }

  private async publishText(
    title: string,
    body: string,
    dryrun = false,
  ): Promise<object> {
    Logger.trace("Reddit.publishText");
    if (!dryrun) {
      return (await this.api.post("submit", {
        sr: this.SUBREDDIT,
        kind: "self",
        title: title,
        text: body,
        api_type: "json",
        extension: "json",
      })) as {
        json: {
          errors: string[];
          data: {
            user_submitted_page: string;
            websocket_url: string;
          };
        };
      };
    }
    return {
      dryrun: true,
    };
  }

  private async publishImage(
    title: string,
    file: string,
    dryrun = false,
  ): Promise<object> {
    Logger.trace("Reddit.publishImage");
    const lease = await this.getUploadLease(file);
    const imageUrl = await this.uploadFile(lease, file);
    if (!dryrun) {
      return (await this.api.post("submit", {
        sr: this.SUBREDDIT,
        kind: "image",
        title: title,
        url: imageUrl,
        api_type: "json",
        extension: "json",
      })) as {
        json: {
          errors: string[];
          data: {
            user_submitted_page: string;
            websocket_url: string;
          };
        };
      };
    }
    return {
      dryrun: true,
    };
  }

  private async publishVideo(
    title: string,
    file: string,
    dryrun = false,
  ): Promise<object> {
    Logger.trace("Reddit.publishVideo");
    const lease = await this.getUploadLease(file);
    const videoUrl = await this.uploadFile(lease, file);
    if (!dryrun) {
      return (await this.api.post("submit", {
        sr: this.SUBREDDIT,
        kind: "video",
        title: title,
        url: videoUrl,
        video_poster_url: "", // TODO
        api_type: "json",
        extension: "json",
      })) as {
        json: {
          errors: string[];
          data: {
            user_submitted_page: string;
            websocket_url: string;
          };
        };
      };
    }
    return {
      dryrun: true,
    };
  }

  private async getUploadLease(file: string): Promise<{
    action: string;
    fields: {
      [name: string]: string;
    };
  }> {
    const filename = path.basename(file);
    const mimetype = Folder.guessMimeType(filename);

    const form = new FormData();
    form.append("filepath", filename);
    form.append("mimetype", mimetype);

    const lease = (await this.api.postForm("media/asset.json", form)) as {
      args: {
        action: string;
        fields: {
          name: string;
          value: string;
        }[];
      };
    };
    if (!lease.args?.action || !lease.args?.fields) {
      const msg = "Reddit.getUploadLease: bad answer";
      throw Logger.error(msg, lease);
    }

    return {
      action: "https:" + lease.args.action,
      fields: Object.assign(
        {},
        ...lease.args.fields.map((f) => ({ [f.name]: f.value })),
      ),
    };
  }

  private async uploadFile(
    lease: {
      action: string;
      fields: {
        [name: string]: string;
      };
    },
    file: string,
  ): Promise<string> {
    const buffer = fs.readFileSync(file);
    const filename = path.basename(file);

    const form = new FormData();
    for (const fieldname in lease.fields) {
      form.append(fieldname, lease.fields[fieldname]);
    }
    form.append("file", new Blob([buffer]), filename);
    Logger.trace("POST", lease.action);

    const responseRaw = await fetch(lease.action, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: form,
    });
    const response = await responseRaw.text();
    try {
      const parser = new XMLParser();
      const xml = parser.parse(response);
      const encodedURL = xml.PostResponse.Location;
      if (!encodedURL) {
        const msg = "Reddit.uploadFile: No URL returned";
        throw Logger.error(msg, xml);
      }
      return decodeURIComponent(encodedURL);
    } catch (e) {
      const msg = "Reddit.uploadFile: cant parse xml";
      throw Logger.error(msg, response, e);
    }
  }
}
