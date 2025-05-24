import { dirname, basename, extname } from "path";

import sharp from "sharp";
import Feed from "./Feed.ts";
import {
  SourceStage,
  PostStatus,
  FileInfo,
  FileGroup,
} from "../types/index.ts";
import Platform from "./Platform.ts";
import Post from "./Post.ts";
import SourceMapper from "../mappers/SourceMapper.ts";

/**
 * Source - a folder within a feed
 *
 * A source represents one post on all enabled
 * and applicable platforms. It is also just
 * a folder on a filesystem.
 *
 * be sure not to do much heavy lifting in the constructor.
 * source objects should be light, because they
 * are often just hubs to get to posts.
 */
export default class Source {
  feed: Feed;
  id: string;
  path: string;
  stage: SourceStage;
  files?: FileInfo[];
  mapper: SourceMapper;

  /**
   * Dont call the constructor yourself;
   * instead, call `await Source.getSource()`
   * @param feed
   * @param path
   */
  constructor(feed: Feed, path: string) {
    this.feed = feed;
    this.id = this.getSourceId(path);
    this.path = path;
    this.mapper = new SourceMapper(this);
    this.stage = this.getSourceStage();
  }

  /**
   * getSourcePath
   *
   * Get the path for a source in a feed, based on stage and id
   * @param feed - the feed this source belongs to
   * @param id - the id of the source
   * @param stage - the stage of the source
   * @returns the path to the source
   */
  public static getSourcePath(
    feed: Feed,
    id: string,
    stage: SourceStage,
  ): string {
    return feed.getStagePath(stage) + "/" + id;
  }

  /**
   * get source id based on the path of a source
   * @param path the path for the new or existing source
   * @returns the id for the new or existing source
   */
  public getSourceId(path: string): string {
    return basename(path); // ah, simple
  }

  /**
   * Get the stage of this source.
   *
   * The stage depends on the various statusses of the posts
   * in the source. The path of the source depends on the status,
   * and here we just check the path to see its current status.
   * @returns {SourceStage} - the status of the source
   */
  public getSourceStage(): SourceStage {
    const parent = dirname(this.path);
    for (const stage of Object.values(SourceStage)) {
      const stagePath = this.feed.getStagePath(stage);
      if (parent.endsWith(stagePath)) {
        return stage;
      }
    }
    return SourceStage.UNKNOWN;
  }

  /**
   * getSource
   *
   * get a new source and do some async checks.
   * @param feed - the feed this source belongs to
   * @param id - the id of the source
   * @param stage - optional stage to find the source in
   * @returns new source object
   */

  public static async getSource(
    feed: Feed,
    id: string,
    stage?: SourceStage,
  ): Promise<Source> {
    const stages = stage ? [stage] : Object.values(SourceStage);
    for (const stage of stages) {
      const sourcePath = Source.getSourcePath(feed, id, stage);
      if (await feed.user.files.isDir(sourcePath)) {
        return new Source(feed, sourcePath);
      }
    }
    throw feed.user.log.error("getSource", "Not a valid source: " + id, stage);
  }

  /**
   * Update the stage of a source.
   *
   * The stage of the source depends on the various statusses
   * of the posts in the source. Post.save calls this method.
   * The path of the source depends on the stage, so if
   * it is updated source may move to a new location.
   * @returns {SourceStage} - the new stage of the source
   */
  public async updateStage(): Promise<SourceStage> {
    this.feed.user.log.trace("Source", "updateStage");

    // check all posts to check their status
    const orgStage = this.stage;
    let newStage: SourceStage | undefined = undefined;

    if (this.stage === SourceStage.ARCHIVED) {
      newStage = SourceStage.ARCHIVED;
    } else {
      const posts = await this.getPosts();
      if (posts.length === 0) {
        newStage = SourceStage.INCOMING;
      } else if (
        posts.every(
          (post: Post) =>
            post.status === PostStatus.PUBLISHED ||
            post.status === PostStatus.CANCELED,
        )
      ) {
        newStage = SourceStage.FINISHED;
      } else if (
        posts.every((post: Post) => post.status === PostStatus.UNSCHEDULED)
      ) {
        newStage = SourceStage.PENDING;
      } else if (
        posts.every((post: Post) => post.status === PostStatus.UNKNOWN)
      ) {
        newStage = SourceStage.UNKNOWN;
      }
      if (newStage === undefined) {
        newStage = SourceStage.ACTIVE;
      }
    }
    if (orgStage === newStage) {
      this.feed.user.log.trace(this.id, "updateStage", "no change");
      return this.stage;
    }

    // if our stage changed,
    // move this source to the new location
    this.feed.user.log.trace(
      this.id,
      "updateStage",
      "stage changed",
      orgStage,
      newStage,
    );
    const newPath = Source.getSourcePath(this.feed, this.id, newStage);
    if (await this.feed.user.files.exists(newPath)) {
      this.feed.user.log.error(
        this.id,
        "updateStatus",
        "source already exists: " + newPath,
      );
      return this.stage;
    }

    // move directory
    const log = await this.feed.user.files.moveDir(this.path, newPath);
    for (const msg of log) {
      this.feed.user.log.trace(msg);
    }

    // update my stage and clear feed cache
    this.path = newPath;
    this.stage = newStage;
    this.feed.clearCache();

    return this.stage;
  }

  /**
   * Get the files in this source
   *
   * reads info from disk once, then caches that
   * @returns array of fileinfo for all files in this source
   */

  public async getFiles(): Promise<FileInfo[]> {
    if (this.files !== undefined) {
      return structuredClone(this.files); // todo clone where this is called
    }
    const fileNames = await this.getFileNames();
    this.files = [];
    for (let index = 0; index < fileNames.length; index++) {
      this.files.push(await this.getFileInfo(fileNames[index], index));
    }
    return structuredClone(this.files);
  }

  /**
   * Get info for a single file
   * @param name - name of the file in this source
   * @param order - order to set on this file
   * @returns fileinfo object for the file
   */
  public async getFileInfo(name: string, order: number): Promise<FileInfo> {
    const filepath = this.path + "/" + name;
    const mime = await this.feed.user.files.getMimeType(filepath);
    const group = mime.split("/")[0];
    const extension = extname(name);
    const size = await this.feed.user.files.getSize(filepath);
    const file = {
      name: name,
      basename: basename(name, extension || ""),
      extension: extension.substring(1),
      group: Object.values(FileGroup).includes(group as FileGroup)
        ? group
        : FileGroup.OTHER,
      mimetype: mime,
      size: size,
      order: order,
    } as FileInfo;
    if (group === FileGroup.IMAGE) {
      const buffer = await this.feed.user.files.readBuffer(filepath);
      const metadata = await sharp(buffer).metadata();
      file.width = metadata.width;
      file.height = metadata.height;
    }
    return file;
  }

  /**
   * preparePost
   * this is just an alias of Platform.preparePost(source)
   */

  public async preparePost(platform: Platform): Promise<Post> {
    this.feed.user.log.trace(this.id, "preparePost", this.id, platform.id);
    return await platform.preparePost(this);
  }

  /**
   * getPost
   * this is just an alias of Platform.getPost(source)
   */

  public async getPost(platform: Platform): Promise<Post> {
    this.feed.user.log.trace(this.id, "getPost", this.id, platform.id);
    return await platform.getPost(this);
  }

  /**
   * Get multiple (prepared) posts.
   * @param platforms - platforms to filter on
   * @param status - post status to filter on
   * @returns multiple posts
   */

  public async getPosts(
    platforms?: Platform[],
    status?: PostStatus,
  ): Promise<Post[]> {
    this.feed.user.log.trace(this.id, "getPosts", this.id);
    const posts: Post[] = [];
    if (!platforms) {
      platforms = this.feed.user.getPlatforms();
    }
    for (const platform of platforms) {
      try {
        const post = await this.getPost(platform);
        if (!status || status === post.status) {
          posts.push(post);
        }
      } catch {
        continue;
      }
    }
    return posts;
  }

  /**
   * Get the filenames in this source;
   * no directories, no hidden files
   * @returns array of filenames relative to source
   */

  private async getFileNames(): Promise<string[]> {
    if (this.files !== undefined) {
      return this.files.map((file) => file.name);
    }
    const files = this.feed.user.files.list(this.path).filter((file) => {
      if (file.type === "directory" || file.isDirectory) return false;
      const filename = basename(file.path);
      if (filename.startsWith("_")) return false;
      if (filename.startsWith(".")) return false;
      return true;
    });
    return (await files.toArray()).map((file) => basename(file.path));
  }
}
