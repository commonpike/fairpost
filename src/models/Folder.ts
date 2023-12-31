import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

import Logger from "../services/Logger";

/**
 * Folder - a folder within a feed
 *
 * A folder represents one post on all enabled
 * and applicable platforms. It is also just
 * a folder on a filesystem.
 */
export default class Folder {
  id: string;
  path: string;
  files?: FileInfo[];

  constructor(path: string) {
    if (!fs.statSync(path).isDirectory()) {
      throw Logger.error("No such folder: " + path);
    }
    this.id = path.replace(/^\//, "").split("/").slice(1).join("/");
    this.path = path;
  }

  /**
   * Return a small report for this feed
   * @returns the report in text
   */

  report(): string {
    Logger.trace("Folder", "report");
    let report = "";
    report += "\nFolder: " + this.id;
    report += "\n - path: " + this.path;
    report += "\n - files: " + this.getFileNames();
    return report;
  }

  /**
   * Get the files in this folder
   *
   * reads info from disk once, then caches that
   * @returns array of fileinfo for all files in this folder
   */

  public async getFiles(): Promise<FileInfo[]> {
    Logger.trace("Folder", "getFiles");
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
   * @param name - name of the file in this folder
   * @param order - order to set on this file
   * @returns fileinfo object for the file
   */
  public async getFileInfo(name: string, order: number): Promise<FileInfo> {
    Logger.trace("Folder", "getFile", name);
    const filepath = this.path + "/" + name;
    const mime = this.guessMimeType(name);
    const group = mime !== "application/unknown" ? mime.split("/")[0] : "other";
    const stats = fs.statSync(filepath);
    const extension = path.extname(name);
    const file = {
      name: name,
      basename: path.basename(name, extension || ""),
      extension: extension.substring(1),
      group: group,
      mimetype: mime,
      size: stats.size,
      order: order,
    } as FileInfo;
    if (group === "image") {
      const metadata = await sharp(filepath).metadata();
      file.width = metadata.width;
      file.height = metadata.height;
    }
    return file;
  }

  /**
   * Get the filenames in this folder
   * @returns array of filenames relative to folder
   */

  private getFileNames(): string[] {
    Logger.trace("Folder", "getFileNames");
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
  group: string;
  size: number;
  mimetype: string;
  order: number;
  width?: number;
  height?: number;
}
