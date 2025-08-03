import { FileGroup, FieldMapping } from "../../types/index.ts";
import Source from "../../models/Source.ts";

import Operator from "../../models/Operator.ts";
import Platform from "../../models/Platform.ts";
import Post from "../../models/Post.ts";
import BlueskyAuth from "./BlueskyAuth.ts";
import { BlobRef } from "@atproto/api";
// import { AppBskyVideoDefs, AtpAgent } from "@atproto/api";
import PlatformMapper from "../../mappers/PlatformMapper.ts";
import User from "../../models/User.ts";

/**
 * Bluesky: support for bluesky platform
 */

export default class Bluesky extends Platform {
  assetsFolder = "_bluesky";
  postFileName = "post.json";
  pluginSettings = {
    limitfiles: {
      video_max: 1,
      image_max: 4,
    },
    imagesize: {
      max_size: 1000,
    },
  };
  settings: FieldMapping = {};
  auth: BlueskyAuth;

  constructor(user: User) {
    super(user);
    this.auth = new BlueskyAuth(user);
    this.mapper = new PlatformMapper(this);
  }

  /** @inheritdoc */
  async setup(operator: Operator) {
    if (operator.ui === "cli") {
      return await this.auth.setupCli();
    }
    return await this.auth.setupApi();
  }

  /** @inheritdoc */
  async test() {
    this.user.log.trace("Bluesky.test");
    const agent = await this.auth.getAgent();
    return await agent.com.atproto.server.getSession();
  }

  /** @inheritdoc */
  async refresh(): Promise<boolean> {
    //await this.auth.refresh();
    return true;
  }

  /** @inheritdoc */

  async preparePost(source: Source): Promise<Post> {
    this.user.log.trace("Bluesky.preparePost", source.id);
    const post = await super.preparePost(source);
    if (post) {
      const userPluginSettings = JSON.parse(
        this.user.data.get("settings", "BLUESKY_PLUGIN_SETTINGS", "{}"),
      );
      const pluginSettings = {
        ...this.pluginSettings,
        ...(userPluginSettings || {}),
      };
      const plugins = this.loadPlugins(pluginSettings);
      for (const plugin of plugins) {
        await plugin.process(post);
      }

      // Annimated GIF will be sent as a video. Only one animated GIF can be sent per post.

      // video
      // Supported formats: MP4.
      // Duration max: 4 minutes.
      // Duration min: 1 second.
      // Aspect ratio must be between 1:3 and 3:1.

      await post.save();
    }
    return post;
  }

  /** @inheritdoc */
  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    this.user.log.trace("Bluesky.publishPost", post.id, dryrun || "");

    let response = { uri: "at://local/nop" } as { uri: string };
    let error = undefined as Error | undefined;

    if (post.hasFiles(FileGroup.VIDEO)) {
      try {
        response = await this.publishVideoPost(post, dryrun);
      } catch (e) {
        error = e as Error;
      }
    } else if (post.hasFiles(FileGroup.IMAGE)) {
      try {
        response = await this.publishImagesPost(post, dryrun);
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
      response.uri,
      this.atUriToBskyAppUrl(response.uri),
      {
        date: new Date(),
        dryrun: dryrun,
        success: !error,
        response: response,
        error: error,
      },
    );
  }

  /**
   * post body text
   * @param post - the post
   * @param dryrun - wether to really execure
   * @returns object, incl. id of the created post
   */

  private async publishTextPost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{
    uri: string;
  }> {
    this.user.log.trace("Blueksy.publishTextPost", post.id, dryrun || "");
    const agent = await this.auth.getAgent();
    if (dryrun) {
      return { uri: "at://local/dryrun" };
    }
    const response = await agent.post({
      text: post.getCompiledBody(),
      createdAt: new Date().toISOString(),
    });
    //if (result.validationStatus !== 'valid') {
    //  throw this.user.log.error(result.errors.join());
    // }
    if (!response.uri || !response.cid) {
      throw this.user.log.error("Invalid response", response);
    }
    return response;
  }

  /**
   * Upload a images to bluesky
   * and create a post with body & images
   * @param post - the post to publish
   * @param dryrun - wether to actually post it
   * @returns object incl uri of the created post
   */

  private async publishImagesPost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{
    uri: string;
  }> {
    this.user.log.trace("Bluesky.publishImagesPost", post.id, dryrun || "");

    const agent = await this.auth.getAgent();

    const images = [] as {
      alt: string;
      image: BlobRef;
      aspectRatio: {
        width: number;
        height: number;
      };
    }[];

    for (const image of post.getFiles(FileGroup.IMAGE).splice(0, 4)) {
      const path = post.getFilePath(image.name);
      images.push({
        alt: image.basename.replace(/[-_]/g, " "),
        image: await this.uploadImage(path),
        aspectRatio: {
          width: image.width ?? 0,
          height: image.height ?? 0,
        },
      });
    }

    if (dryrun) {
      return { uri: "at://local/dryrun" };
    }

    this.user.log.trace("Posting " + post.id + "...");
    const response = await agent.post({
      text: post.getCompiledBody(),
      createdAt: new Date().toISOString(),
      embed: {
        $type: "app.bsky.embed.images",
        images: images,
      },
    });

    //if (result.validationStatus !== 'valid') {
    //  throw this.user.log.error(result.errors.join());
    // }
    if (!response.uri || !response.cid) {
      throw this.user.log.error("Invalid response", response);
    }
    return response;
  }

  /**
   * Upload a video to bluesky
   * and create a post with body & video
   * @param post - the post to publish
   * @param dryrun - wether to actually post it
   * @returns object incl uri of the created post
   */

  private async publishVideoPost(
    post: Post,
    dryrun: boolean = false,
  ): Promise<{
    uri: string;
  }> {
    this.user.log.trace("Bluesky.publishVideoPost", post.id, dryrun || "");
    const agent = await this.auth.getAgent();
    const video = post.getFiles(FileGroup.VIDEO)[0];
    const path = post.getFilePath(video.name);
    const blob = await this.uploadVideo(path);
    if (dryrun) {
      return { uri: "at://local/dryrun" };
    }
    this.user.log.trace("Posting " + post.id + "...");
    const response = await agent.post({
      text: post.getCompiledBody(),
      createdAt: new Date().toISOString(),
      embed: {
        $type: "app.bsky.embed.video",
        video: blob,
        //aspectRatio: {
        //      width: image.width ?? 0,
        //      height: image.height ?? 0
        //}
      },
    });

    //if (result.validationStatus !== 'valid') {
    //  throw this.user.log.error(result.errors.join());
    // }
    if (!response.uri || !response.cid) {
      throw this.user.log.error("Invalid response", response);
    }
    return response;
  }

  /**
   * POST an image using the agents uploadBlob
   * @param path - path to the file to post
   * @returns blobref of the uploaded video to use in post embed
   */
  private async uploadImage(path: string = ""): Promise<BlobRef> {
    this.user.log.trace("Bluesky.uploadImage", path);
    const agent = await this.auth.getAgent();
    const buffer = await this.user.files.readBuffer(path);
    this.user.log.trace("Uploading " + path + "...");
    try {
      const { data } = await agent.uploadBlob(buffer, {});
      return data.blob;
    } catch (e) {
      throw this.user.log.error("Bluesky.uploadImage", "failed", e);
    }
  }

  /**
   * POST a video to the uploadVideo endpoint using fetch
   * and waiting for the response - async.
   * @param path - path to the file to post
   * @returns blobref of the uploaded video to use in post embed
   */
  private async uploadVideo(path: string = ""): Promise<BlobRef> {
    this.user.log.trace("Bluesky.uploadVideo", path);
    const agent = await this.auth.getAgent();

    // this is fine for smaller videos
    const buffer = await this.user.files.readBuffer(path);
    this.user.log.trace("Uploading " + path + "...");
    try {
      const { data } = await agent.uploadBlob(buffer, {});
      return data.blob;
    } catch (e) {
      throw this.user.log.error("Bluesky.uploadVideo", "failed", e);
    }

    // below method should work for larger videos - but it fails
    // later with failed XRPCError: Could not find blob
    // https://docs.bsky.app/docs/tutorials/video
    /*
      // get a service auth
      const { data: serviceAuth } = await agent.com.atproto.server.getServiceAuth(
        {
          aud: `did:web:${agent.dispatchUrl.host}`,
          lxm: "com.atproto.repo.uploadBlob",
          exp: Date.now() / 1000 + 60 * 30, // 30 minutes
        },
      );

      // prepare request
      const token = serviceAuth.token;
      const uploadUrl = new URL(
        "https://video.bsky.app/xrpc/app.bsky.video.uploadVideo",
      );
      uploadUrl.searchParams.append("did", agent.session!.did);
      uploadUrl.searchParams.append("name", path.split("/").pop()!);

      // do the request
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": await this.user.files.getMimeType(path),
          "Content-Length": String(await this.user.files.getSize(path))
        },
        body: await this.user.files.readBuffer(path),
      });

      // wait for the upload to finish
      const jobStatus = (await uploadResponse.json()) as AppBskyVideoDefs.JobStatus;
      let blob: BlobRef | undefined = jobStatus.blob;
      const videoAgent = new AtpAgent({ service: "https://video.bsky.app" });

      while (!blob) {
        // todo: emergency exit
        const { data: status } = await videoAgent.app.bsky.video.getJobStatus(
          { jobId: jobStatus.jobId },
        );
        this.user.log.trace("Bluesky.uploadImage", 
          status.jobStatus.state,
          status.jobStatus.progress || "",
        );
        if (status.jobStatus.blob) {
          blob = status.jobStatus.blob;
        }
        // wait a second
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // return result
      return blob;
    */
  }

  /**
   * Converts an AT URI for a Bluesky post to a https://bsky.app.
   * https://github.com/bluesky-social/atproto/discussions/2523#discussioncomment-12096639
   * @param atUri The AT URI of the post.  Must be in the format at://<DID>/<COLLECTION>/<RKEY>
   * @returns The HTTPS URL to view the post on bsky.app, or null if the AT URI is invalid or not a post.
   */
  private atUriToBskyAppUrl(atUri: string): string {
    const regex = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/;
    const match = atUri.match(regex);

    if (!match) {
      return "#invalid"; // Invalid AT URI format
    }

    const did = match[1];
    const collection = match[2];
    const rkey = match[3];

    if (collection === "app.bsky.feed.post") {
      return `https://bsky.app/profile/${did}/post/${rkey}`;
    } else {
      return "#invalid"; // Not a post record
    }
  }
}
