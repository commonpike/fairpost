import * as fs from "fs";
import * as path from "path";

import sharp from "sharp";

/**
 * Source - a folder within a feed
 *
 * A source represents one post on all enabled
 * and applicable platforms. It is also just
 * a folder on a filesystem.
 */
export default class Source {
  id: string;
  path: string;
  files?: FileInfo[];

  constructor(path: string) {
    if (!fs.statSync(path).isDirectory()) {
      throw new Error("No such source: " + path);
    }
    this.id = path.replace(/^\//, "").split("/").slice(1).join("/");
    this.path = path;
  }

  /**
   * Return a small report for this feed
   * @returns the report in text
   */

  report(): string {
    let report = "";
    report += "\nSource: " + this.id;
    report += "\n - path: " + this.path;
    report += "\n - files: " + this.getFileNames();
    return report;
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
