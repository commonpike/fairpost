import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

import Folder from "../../models/Folder";
import Logger from "../../services/Logger";
import Platform from "../../models/Platform";
import { PlatformId } from "..";
import Post from "../../models/Post";
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

  /** @inheritdoc */
  async preparePost(folder: Folder): Promise<Post | undefined> {
    Logger.trace("Reddit.preparePost", folder.id);
    const post = await super.preparePost(folder);
    if (post) {
      // reddit: max 1 image or video
      // TODO: extract video thumbnail
      if (post.hasFiles('video')) { // eslint-disable-line
        post.limitFiles("video", 1);
        post.removeFiles("image");
      }
      if (post.hasFiles("image")) {
        post.limitFiles("image", 1);
        // <MaxSizeAllowed>20971520</MaxSizeAllowed>
        const file = post.getFiles("image")[0];
        const src = file.name;
        if (file.width > 3000) {
          Logger.trace("Resizing " + src + " for reddit ..");
          const dst = this.assetsFolder() + "/reddit-" + file.basename + ".jpg";
          await sharp(post.getFilePath(src))
            .resize({
              width: 3000,
            })
            .toFile(post.getFilePath(dst));
          await post.replaceFile(src, dst);
        }
      }
      post.save();
    }
    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("Reddit.publishPost", post.id, dryrun);

    let response = {};
    let error = undefined;

    if (post.hasFiles("video")) {
      try {
        response = await this.publishVideoPost(post, dryrun);
      } catch (e) {
        error = e;
      }
    } else if (post.hasFiles("image")) {
      try {
        response = await this.publishImagePost(post, dryrun);
      } catch (e) {
        error = e;
      }
    } else {
      try {
        response = await this.publishTextPost(post, dryrun);
      } catch (e) {
        error = e;
      }
    }

    return post.processResult(
      "#unknown", // todo: listen to websocket for id
      "#unknown", // todo: listen to websocket for link
      {
        date: new Date(),
        dryrun: dryrun,
        success: !error,
        error: error,
        response: response,
      },
    );
  }

  /**
   * POST self-post to the submit endpoint using json
   * @param post
   * @param dryrun
   * @returns result
   */
  private async publishTextPost(post: Post, dryrun = false): Promise<object> {
    Logger.trace("Reddit.publishTextPost");
    const title = post.title;
    const body = post.getCompiledBody("!title");
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

  /**
   * POST image post to the submit endpoint using json
   * @param post
   * @param dryrun
   * @returns result
   */
  private async publishImagePost(post: Post, dryrun = false): Promise<object> {
    Logger.trace("Reddit.publishImagePost");
    const title = post.title;
    const file = post.getFilePath(post.getFiles("image")[0].name);
    const leash = await this.getUploadLeash(file);
    const imageUrl = await this.uploadFile(leash, file);
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

  /**
   * POST video post to the submit endpoint using json
   * @param post
   * @param dryrun
   * @returns result
   */
  private async publishVideoPost(post: Post, dryrun = false): Promise<object> {
    Logger.trace("Reddit.publishVideoPost");
    const title = post.title;
    const file = post.getFilePath(post.getFiles("video")[0].name);
    const leash = await this.getUploadLeash(file);
    const videoUrl = await this.uploadFile(leash, file);
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

  /**
   * POST to media/asset.json to get a leash with a lot of fields,
   *
   * All these fields should be reposted on the upload
   * @param file - path to the file to upload
   * @returns leash - args with action and fields
   */
  private async getUploadLeash(file: string): Promise<{
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

    const leash = (await this.api.postForm("media/asset.json", form)) as {
      args: {
        action: string;
        fields: {
          name: string;
          value: string;
        }[];
      };
    };
    if (!leash.args?.action || !leash.args?.fields) {
      const msg = "Reddit.getUploadLeash: bad answer";
      throw Logger.error(msg, leash);
    }

    return {
      action: "https:" + leash.args.action,
      fields: Object.assign(
        {},
        ...leash.args.fields.map((f) => ({ [f.name]: f.value })),
      ),
    };
  }

  /**
   * POST file as formdata using a leash
   * @param leash
   * @param leash.action - url to post to
   * @param leash.fields - fields to post
   * @param file - path to the file to upload
   * @returns url to uploaded file
   */
  private async uploadFile(
    leash: {
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
    for (const fieldname in leash.fields) {
      form.append(fieldname, leash.fields[fieldname]);
    }
    form.append("file", new Blob([buffer]), filename);
    Logger.trace("POST", leash.action);

    const responseRaw = await fetch(leash.action, {
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
