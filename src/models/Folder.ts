import * as fs from "fs";
import * as path from "path";

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
  files?: {
    text: string[];
    image: string[];
    video: string[];
    other: string[];
  };

  constructor(path: string) {
    this.id = path;
    this.path = path;
  }

  /**
   * Return a small report for this feed
   * @returns the report in text
   */

  report(): string {
    Logger.trace("Folder", "report");
    const files = this.getFiles();
    let report = "";
    report += "\nFolder: " + this.id;
    report += "\n - path: " + this.path;
    report +=
      "\n - files: " +
      Object.keys(files)
        .map((k) => files[k].join())
        .join();
    return report;
  }

  /**
   * Get the files in this folder
   *
   * reads info from disk once, then caches that
   * @returns grouped filenames relative to folder
   */

  getFiles(): {
    text: string[];
    image: string[];
    video: string[];
    other: string[];
  } {
    Logger.trace("Folder", "getFiles");
    if (this.files != undefined) {
      return {
        text: [...this.files.text],
        image: [...this.files.image],
        video: [...this.files.video],
        other: [...this.files.other],
      };
    }
    const files = fs.readdirSync(this.path).filter((file) => {
      return (
        fs.statSync(this.path + "/" + file).isFile() &&
        !file.startsWith("_") &&
        !file.startsWith(".")
      );
    });
    this.files = {
      text: [],
      image: [],
      video: [],
      other: [],
    };
    this.files.text = files.filter((file) =>
      ["txt"].includes(file.split(".")?.pop() ?? ""),
    );
    this.files.image = files.filter((file) =>
      ["jpg", "jpeg", "png"].includes(file.split(".")?.pop() ?? ""),
    );
    this.files.video = files.filter((file) =>
      ["mp4"].includes(file.split(".")?.pop() ?? ""),
    );
    this.files.other = files.filter(
      (file) =>
        !this.files.text?.includes(file) &&
        !this.files.image?.includes(file) &&
        !this.files.video?.includes(file),
    );
    return {
      text: [...this.files.text],
      image: [...this.files.image],
      video: [...this.files.video],
      other: [...this.files.other],
    };
  }

  public static guessMimeType(filename: string) {
    const extension = path.extname(filename);
    const mimeTypes = {
      ".png": "image/png",
      ".mov": "video/quicktime",
      ".mp4": "video/mp4",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
    };
    return mimeTypes[extension] ?? "application/unknown";
  }
}
