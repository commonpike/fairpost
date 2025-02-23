import { basename, extname } from "path";

import sharp from "sharp";
import Feed from "./Feed.ts";
import Platform from "./Platform.ts";
import Post, { PostStatus } from "./Post.ts";
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
    this.id = this.feed.getSourceId(path);
    this.path = path;
    this.mapper = new SourceMapper(this);
  }

  /**
   * getSource
   *
   * get a new source and do some async checks.
   * @param feed - the feed this source belongs to
   * @param path - the path within that feed
   * @returns new source object
   */
  public static async getSource(feed: Feed, path: string): Promise<Source> {
    const source = new Source(feed, feed.path + "/" + path);
    const stat = await feed.user.files.stat(feed.path + "/" + path);
    if (stat.type !== "directory" && !stat.isDirectory) {
      throw feed.user.log.error(
        source.id,
        "getSource",
        "Not a valid source: " + path,
      );
    }
    return source;
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
    const mime = await this.feed.user.files.mimeType(filepath);
    const group = mime.split("/")[0];
    const extension = extname(name);
    const size = await this.feed.user.files.fileSize(filepath);
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
      const buffer = await this.feed.user.files.readToBuffer(filepath);
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

export interface FileInfo {
  name: string;
  original?: string;
  basename: string;
  extension: string;
  group: FileGroup;
  size: number;
  mimetype: string;
  order: number;
  width?: number;
  height?: number;
}

export enum FileGroup {
  VIDEO = "video",
  IMAGE = "image",
  TEXT = "text",
  OTHER = "other",
}
