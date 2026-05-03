import { basename } from "path";
import { FileGroup, FieldMapping, OAuthRequest } from "../../types/index.ts";

import Platform from "../../models/Platform.ts";
import Post from "../../models/Post.ts";
import RedditApi from "./RedditApi.ts";
import RedditAuth from "./RedditAuth.ts";
import PlatformMapper from "../../mappers/PlatformMapper.ts";
import User from "../../models/User.ts";
import Operator from "../../models/Operator.ts";
import { XMLParser } from "fast-xml-parser";

/**
 * Reddit: support for reddit platform
 */
export default class Reddit extends Platform {
  assetsFolder = "_reddit";
  postFileName = "post.json";
  pluginSettings = {
    limitfiles: {
      prefer: ["video"],
      total_max: 1,
    },
    imagesize: {
      max_width: 3000,
    },
  };
  settings: FieldMapping = {
    REDDIT_SUBREDDIT: {
      type: "string",
      label: "Subreddit to post in",
      get: ["managePlatforms"],
      set: ["managePlatforms"],
      required: true,
    },
    REDDIT_FLAIR: {
      type: "string",
      label: "Flair to add to posts",
      get: ["managePlatforms"],
      set: ["managePlatforms"],
      required: true,
    },
    REDDIT_FLAIR_TEXT: {
      type: "string",
      label: "Text to add to flair",
      get: ["managePlatforms"],
      set: ["managePlatforms"],
      required: true,
    },
    REDDIT_PLUGIN_SETTINGS: {
      type: "json",
      label: "Reddit Plugin settings",
      get: ["managePlatforms"],
      set: ["managePlatforms"],
      required: false,
      default: this.pluginSettings,
    },
  };
  SUBREDDIT: string;
  FLAIR: string;
  FLAIR_TEXT: string;
  api: RedditApi;
  auth: RedditAuth;

  constructor(user: User) {
    super(user);
    this.SUBREDDIT = this.user.data.get("settings", "REDDIT_SUBREDDIT", "");
    this.FLAIR = this.user.data.get("settings", "REDDIT_FLAIR", "");
    this.FLAIR_TEXT = this.user.data.get("settings", "REDDIT_FLAIR_TEXT", "");
    this.api = new RedditApi(user);
    this.auth = new RedditAuth(user);
    this.mapper = new PlatformMapper(this);
  }

  /** @inheritdoc */
  async connect(operator: Operator, payload?: object) {
    if (operator.ui === "cli") {
      await this.auth.connectCli();
      const test = await this.test();
      this.connected = true;
      await this.save();
      return test;
    }
    if (operator.ui === "api") {
      const oauthPayload = payload as OAuthRequest;
      const oauthResponse = await this.auth.connectApi(oauthPayload);
      if (oauthResponse.phase !== "finish") {
        return oauthResponse;
      }
      if (oauthResponse.authenticated) {
        oauthResponse.results = await this.test();
        this.connected = true;
        await this.save();
        return oauthResponse;
      }
      return oauthResponse;
    }
    throw this.user.log.error(
      `${this.id} connect: ui ${operator.ui} not supported`,
    );
  }

  /** @inheritdoc */
  async test() {
    const me = (await this.api.get("me")) as {
      id: string;
      name: string;
    };
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
  async preparePost(post: Post) {
    this.user.log.trace("Reddit.preparePost", post.id);
    // TODO: extract video thumbnail
    let videoposter = "";
    if (post.hasFiles(FileGroup.VIDEO)) {
      let srcposter = "";
      const dstposter = this.assetsFolder + "/reddit-poster.png";
      const posters = post
        .getFiles(FileGroup.IMAGE)
        .filter((file) => file.basename === "poster");
      if (posters.length) {
        srcposter = posters[0].name;
      } else if (post.hasFiles(FileGroup.IMAGE)) {
        // copy the first image to poster
        srcposter = post.getFiles(FileGroup.IMAGE)[0].name;
      } else {
        // create a poster using ffmpeg
        try {
          throw this.user.log.error(
            "video poster.jpg missing - thumbnails not implemented",
          );
          // https://creatomate.com/blog/how-to-use-ffmpeg-in-nodejs
          // const video = post.getFiles('video')[0];
          // this.user.log.trace("Reddit.preparePost", "creating thumbnail", video.name, dstposter);
          // this.generateThumbnail(post.getFilePath(video.name),post.getFilePath(dstposter));
        } catch {
          post.valid = false;
        }
      }
      if (srcposter) {
        // copy that file to its dest
        this.user.log.trace(
          "Reddit.preparePost",
          "copying poster",
          srcposter,
          dstposter,
        );
        await this.user.files.copy(
          post.getFilePath(srcposter),
          post.getFilePath(dstposter),
        );
        post.removeFiles(FileGroup.IMAGE);
        videoposter = dstposter;
      }
    }
    const userPluginSettings = JSON.parse(
      this.user.data.get("settings", "REDDIT_PLUGIN_SETTINGS", "{}"),
    );
    const pluginSettings = {
      ...this.pluginSettings,
      ...(userPluginSettings || {}),
    };
    const plugins = this.loadPlugins(pluginSettings);
    for (const plugin of plugins) {
      await plugin.process(post);
    }
    if (videoposter) {
      await post.addFile(videoposter);
    }
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    this.user.log.trace("Reddit.publishPost", post.id, dryrun);

    // reddit timeout is 1 day;
    // TODO: check timeout
    await this.auth.refresh();

    let response = {};
    let error = undefined as Error | undefined;

    if (post.hasFiles(FileGroup.VIDEO)) {
      try {
        response = await this.publishVideoPost(post, dryrun);
      } catch (e) {
        error = e as Error;
      }
    } else if (post.hasFiles(FileGroup.IMAGE)) {
      try {
        response = await this.publishImagePost(post, dryrun);
      } catch (e) {
        error = e as Error;
      }
    } else {
      try {
        response = await this.publishTextPost(post, dryrun);
      } catch (e) {
        error = e as Error;
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
    this.user.log.trace("Reddit.publishTextPost");
    const title = post.title;
    const body = post.getCompiledBody("!title");
    if (!dryrun) {
      const response = (await this.api.post("submit", {
        sr: this.SUBREDDIT || undefined,
        flair_id: this.FLAIR || undefined,
        flair_text: this.FLAIR_TEXT || undefined,
        kind: "self",
        title: title,
        text: body,
        api_type: "json",
        extension: "json",
      })) as {
        json: {
          errors: string[][];
          data: {
            user_submitted_page: string;
            websocket_url: string;
          };
        };
      };
      if (response.json?.errors?.length) {
        throw this.user.log.error(response.json.errors.flat());
      }
      return response;
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
    this.user.log.trace("Reddit.publishImagePost");
    const title = post.title;
    const image = post.getFiles(FileGroup.IMAGE)[0];
    const file = post.getFilePath(image.name);
    const leash = await this.getUploadLeash(file, image.mimetype);
    const imageUrl = await this.uploadFile(leash, file);
    if (!dryrun) {
      const response = (await this.api.post("submit", {
        sr: this.SUBREDDIT || undefined,
        flair_id: this.FLAIR || undefined,
        flair_text: this.FLAIR_TEXT || undefined,
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
      if (response.json?.errors?.length) {
        throw this.user.log.error(response.json.errors.flat());
      }
      return response;
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
    this.user.log.trace("Reddit.publishVideoPost");
    const title = post.title;

    // upload poster first
    const poster = post.getFiles(FileGroup.IMAGE)[0];
    const posterFile = post.getFilePath(poster.name);
    const posterLeash = await this.getUploadLeash(posterFile, poster.mimetype);
    const posterUrl = await this.uploadFile(posterLeash, posterFile);

    // upload video with poster
    const video = post.getFiles(FileGroup.VIDEO)[0];
    const file = post.getFilePath(video.name);
    const leash = await this.getUploadLeash(file, video.mimetype);
    const videoUrl = await this.uploadFile(leash, file);
    if (!dryrun) {
      const response = (await this.api.post("submit", {
        sr: this.SUBREDDIT || undefined,
        flair_id: this.FLAIR || undefined,
        flair_text: this.FLAIR_TEXT || undefined,
        kind: "video",
        title: title,
        url: videoUrl,
        video_poster_url: posterUrl,
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
      if (response.json?.errors?.length) {
        throw this.user.log.error(response.json.errors.flat());
      }
      return response;
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
   * @param mimetype
   * @returns leash - args with action and fields
   */
  private async getUploadLeash(
    file: string,
    mimetype: string,
  ): Promise<{
    action: string;
    fields: {
      [name: string]: string;
    };
  }> {
    const filename = basename(file);

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
      throw this.user.log.error(msg, leash);
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
    const buffer = await this.user.files.readBuffer(file);
    const blob = new Blob([buffer]); // [new Uint8Array(buffer)]
    const filename = basename(file);

    const form = new FormData();
    for (const fieldname in leash.fields) {
      form.append(fieldname, leash.fields[fieldname]);
    }
    form.append("file", blob, filename);
    this.user.log.trace("POST", leash.action);

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
        throw this.user.log.error(msg, xml);
      }
      return decodeURIComponent(encodedURL);
    } catch (e) {
      const msg = "Reddit.uploadFile: cant parse xml";
      throw this.user.log.error(msg, response, e);
    }
  }
}
