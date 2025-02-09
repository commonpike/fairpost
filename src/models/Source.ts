import * as fs from "fs";
import * as path from "path";

import sharp from "sharp";
import Feed from "./Feed";
import Platform from "./Platform";
import Post, { PostStatus } from "./Post";
import SourceMapper from "../mappers/SourceMapper";

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

  constructor(feed: Feed, path: string) {
    this.feed = feed;
    this.id = this.feed.getSourceId(path);
    this.path = feed.path + "/" + path;
    this.mapper = new SourceMapper(this);
    try {
      fs.statSync(this.path).isDirectory();
    } catch {
      throw feed.user.error("No such source: " + path);
    }
  }

  /**
   * Get the files in this source
   *
   * reads info from disk once, then caches that
   * @returns array of fileinfo for all files in this source
   */

  public async getFiles(): Promise<FileInfo[]> {
    if (this.files !== undefined) {
      return structuredClone(this.files);
    }
    const fileNames = this.getFileNames();
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
    const mime = this.guessMimeType(name);
    const group = mime.split("/")[0];
    const stats = fs.statSync(filepath);
    const extension = path.extname(name);
    const file = {
      name: name,
      basename: path.basename(name, extension || ""),
      extension: extension.substring(1),
      group: Object.values(FileGroup).includes(group as FileGroup)
        ? group
        : FileGroup.OTHER,
      mimetype: mime,
      size: stats.size,
      order: order,
    } as FileInfo;
    if (group === FileGroup.IMAGE) {
      const metadata = await sharp(filepath).metadata();
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
    this.feed.user.trace(this.id, "preparePost", this.id, platform.id);
    return platform.preparePost(this);
  }

  /**
   * getPost
   * this is just an alias of Platform.getPost(source)
   */

  public getPost(platform: Platform): Post {
    this.feed.user.trace(this.id, "getPost", this.id, platform.id);
    return platform.getPost(this);
  }

  /**
   * Get multiple (prepared) posts.
   * @param platforms - platforms to filter on
   * @param status - post status to filter on
   * @returns multiple posts
   */

  public getPosts(platforms?: Platform[], status?: PostStatus): Post[] {
    this.feed.user.trace(this.id, "getPosts", this.id);
    const posts: Post[] = [];
    if (!platforms) {
      platforms = this.feed.user.getPlatforms();
    }
    for (const platform of platforms) {
      try {
        const post = this.getPost(platform);
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
   * Get the filenames in this source
   * @returns array of filenames relative to source
   */

  private getFileNames(): string[] {
    if (this.files !== undefined) {
      return this.files.map((file) => file.name);
    }
    const files = fs.readdirSync(this.path).filter((file) => {
      const regex = /^[^._]/;
      return fs.statSync(this.path + "/" + file).isFile() && file.match(regex);
    });
    return files;
  }

  private guessMimeType(filename: string): string {
    const extension = path.extname(filename).toLowerCase();
    const mimeTypes = {
      ".txt": "text/plain",
      ".png": "image/png",
      ".mov": "video/quicktime",
      ".mp4": "video/mp4",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
    } as { [ext: string]: string };
    if (extension in mimeTypes) {
      return mimeTypes[extension];
    }
    return "application/unknown";
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
