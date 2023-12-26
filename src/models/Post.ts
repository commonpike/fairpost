import * as fs from "fs";

import Folder, { FileInfo } from "./Folder";

import Logger from "../services/Logger";
import Platform from "./Platform";
import { isSimilarArray } from "../utilities";

/**
 * Post - a post within a folder
 *
 * A post belongs to one platform and one folder;
 * it is *prepared* and later *published* by the platform.
 * The post serializes to a json file in the folder,
 * where it can be read later for further processing.
 */
export default class Post {
  id: string;
  folder: Folder;
  platform: Platform;
  valid: boolean = false;
  skip: boolean = false;
  status: PostStatus = PostStatus.UNKNOWN;
  scheduled?: Date;
  published?: Date;
  results: PostResult[] = [];
  title: string = "";
  body?: string;
  tags?: string[];
  mentions?: string[];
  geo?: string;
  files?: FileInfo[];
  ignoreFiles?: string[];
  link?: string;
  remoteId?: string;

  constructor(folder: Folder, platform: Platform, data?: object) {
    this.folder = folder;
    this.platform = platform;
    this.id = this.folder.id + ":" + this.platform.id;
    if (data) {
      Object.assign(this, data);
      this.scheduled = this.scheduled ? new Date(this.scheduled) : undefined;
      this.published = this.published ? new Date(this.published) : undefined;
      this.ignoreFiles = this.ignoreFiles ?? [];
    }
    const assetsPath = this.getFilePath(platform.assetsFolder());
    if (!fs.existsSync(assetsPath)) {
      fs.mkdirSync(assetsPath, { recursive: true });
    }
  }

  /**
   * Return a small report for this post
   * @returns the report in text
   */

  report(): string {
    Logger.trace("Post", "report");
    let report = "";
    report += "\nPost: " + this.id;
    report += "\n - valid: " + this.valid;
    report += "\n - status: " + this.status;
    report += "\n - scheduled: " + this.scheduled;
    report += "\n - published: " + this.published;
    report += "\n - link: " + this.link;
    return report;
  }

  /**
   * Save this post to disk
   */

  save(): void {
    Logger.trace("Post", "save");
    const data = { ...this };
    delete data.folder;
    delete data.platform;
    fs.writeFileSync(
      this.platform.getPostFilePath(this.folder),
      JSON.stringify(data, null, "\t"),
    );
  }

  /**
   * Schedule this post and save it
   *
   * this just sets the 'scheduled' date
   * @param date - the date to schedule it on
   */

  schedule(date: Date): void {
    Logger.trace("Post", "schedule");
    this.scheduled = date;
    this.status = PostStatus.SCHEDULED;
    this.save();
  }

  /**
   * Check body for title, #tags, @mentions and %geo
   * and store those in separate fields instead
   */
  decompileBody() {
    const lines = this.body.split("\n");

    // chop title
    const title = lines.shift();
    if (!this.title || this.title === title) {
      this.title = title;
      this.body = lines.join("\n");
    }

    // chop body tail for #tags, @mentions
    // and %geo - any geo

    const rxtag = /#\S+/g;
    const rxtags = /^\s*((#\S+)\s*)+$/g;
    const rxmention = /@\S+/g;
    const rxmentions = /^\s*((@\S+)\s*)+$/g;
    const rxgeo = /^%geo\s+(.*)/i;
    let line = "";
    while (lines.length) {
      line = lines.pop();

      if (!line.trim()) {
        this.body = lines.join("\n");
        continue;
      }

      if (line.match(rxtags)) {
        const tags = line.match(rxtag);
        if (!this.tags?.length || isSimilarArray(tags, this.tags)) {
          this.tags = tags;
          this.body = lines.join("\n");
        }
        continue;
      }

      if (line.match(rxmentions)) {
        const mentions = line.match(rxmention);
        if (!this.mentions?.length || isSimilarArray(mentions, this.mentions)) {
          this.mentions = mentions;
          this.body = lines.join("\n");
        }
        continue;
      }

      if (line.match(rxgeo)) {
        const geo = line.match(rxgeo)[1] ?? "";
        if (!this.geo || this.geo === geo) {
          this.geo = geo;
          this.body = lines.join("\n");
        }
        continue;
      }

      break;
    }
  }

  /**
   * Create a body containing the given arguments
   * @param parts - any of 'title','body','tags','mentions','geo'
   * prepending a ! to every part removes those parts from the default array instead.
   * @returns compiled body
   */
  getCompiledBody(...parts: string[]): string {
    const defaultParts = ["title", "body", "tags", "mentions", "geo"];
    if (!parts.length) {
      parts = defaultParts;
    }
    if (parts.every((part) => part.startsWith("!"))) {
      let realParts = defaultParts;
      parts.forEach((remove) => {
        realParts = realParts.filter((part) => part != remove.substring(1));
      });
      parts = realParts;
    }

    let body = "";
    for (const part of parts) {
      switch (part) {
        case "title":
          body += this.title ? this.title + "\n" : "";
          break;
        case "body":
          body += this.body ? this.body + "\n\n" : "";
          break;
        case "tags":
          body += this.tags ? this.tags.join(" ") + "\n" : "";
          break;
        case "mentions":
          body += this.mentions ? this.mentions.join(" ") + "\n" : "";
          break;
        case "geo":
          body += this.geo ? this.geo + "\n" : "";
          break;
      }
    }
    return body.trim();
  }

  /**
   * @returns the files grouped by their group property
   */
  getGroupedFiles(): { [group: string]: FileInfo[] } {
    return this.files.reduce(function (collector, file) {
      (collector[file["group"]] = collector[file["group"]] || []).push(file);
      return collector;
    }, {});
  }

  /**
   * @param groups - names of groups to return files from
   * @returns the files within those groups, sorted by order
   */
  getFiles(...groups: string[]): FileInfo[] {
    if (!groups.length) {
      return this.files.sort((a, b) => a.order - b.order);
    }
    return this.files
      .filter((file) => groups.includes(file.group))
      .sort((a, b) => a.order - b.order);
  }

  /**
   * @param groups - names of groups to require files from
   * @returns boolean if files in post
   */
  hasFiles(...groups: string[]): boolean {
    if (!groups.length) {
      return !!this.files.length;
    }
    return !!this.files.filter((file) => groups.includes(file.group)).length;
  }

  /**
   * @param group - the name of the group for which to remove the files
   */
  removeFiles(group: string) {
    this.files = this.files.filter((file) => file.group !== group);
  }

  /**
   * @param group - the name of the group for which to remove some files
   * @param size - the number of files to leave in the group
   */
  limitFiles(group: string, size: number) {
    this.getFiles(group).forEach((file, index) => {
      if (index > size) {
        this.removeFile(file.name);
      }
    });
  }

  /**
   * Remove all the files that do not exist (anymore)
   */
  purgeFiles() {
    this.getFiles().forEach((file) => {
      if (file.original && !fs.existsSync(this.getFilePath(file.original))) {
        Logger.info(
          "Post",
          "purgeFiles",
          "purging non-existant derivate",
          file.name,
        );
        this.removeFile(file.name);
      }
      if (!fs.existsSync(this.getFilePath(file.name))) {
        Logger.info(
          "Post",
          "purgeFiles",
          "purging non-existent file",
          file.name,
        );
        this.removeFile(file.name);
      }
    });
  }

  /**
   * reindex file ordering to remove doubles
   */
  reorderFiles() {
    this.files
      .sort((a, b) => a.order - b.order)
      .forEach((file, index) => {
        file.order = index;
      });
  }

  /**
   * @param name the name of the file
   * @returns wether the file exists
   */
  hasFile(name: string): boolean {
    return this.getFile(name) !== undefined;
  }

  /**
   * @param name - the name of the file
   * @returns the files info if any
   */
  getFile(name: string): FileInfo | undefined {
    return this.files.find((file) => file.name === name);
  }

  /**
   * @param file - the fileinfo to add or replace
   */
  putFile(file: FileInfo) {
    const oldFile = this.files.find(
      (oldfile) => oldfile.name === file.name || oldfile.original === file.name,
    );
    if (oldFile) {
      file.order = oldFile.order;
      this.removeFile(oldFile.name);
    }
    this.files.push(file);
  }

  /**
   * @param name the name of the file to remove
   */
  removeFile(name: string) {
    this.files = this.files.filter((file) => file.name !== name);
  }

  /**
   * @param search - the name of the file to replace
   * @param replace - the name of the file to replace it with
   * @returns the info of the replaced file
   */
  async replaceFile(search: string, replace: string): Promise<FileInfo> {
    const index = this.files.findIndex((file) => file.name === search);
    if (index > -1) {
      const oldFile = this.getFile(search);
      const newFile = await this.folder.getFile(replace, oldFile.order);
      newFile.original = oldFile.name;
      this.files[index] = newFile;
    }
    return this.files[index];
  }

  /**
   * @param name relative path in this post.folder
   * @returns the full path to that file
   */
  getFilePath(name: string): string {
    return this.folder.path + "/" + name;
  }

  /**
   * Process a post result. Push the result to results[],
   * and if not dryrun, fix dates and statusses and
   * note remote id and link
   * @param remoteId - the remote id of the post
   * @param link - the remote link of the post
   * @param result - the postresult
   * @returns boolean if success
   */

  processResult(remoteId: string, link: string, result: PostResult): boolean {
    this.results.push(result);

    if (result.error) {
      Logger.warn(
        "Post.processResult",
        this.id,
        "failed",
        result.error,
        result.response,
      );
    }

    if (!result.dryrun) {
      if (!result.error) {
        this.remoteId = remoteId;
        this.link = link;
        this.status = PostStatus.PUBLISHED;
        this.published = new Date();
      } else {
        this.status = PostStatus.FAILED;
      }
    }

    this.save();
    return result.success;
  }
}

export interface PostResult {
  date: Date;
  dryrun?: boolean;
  error?: Error;
  success: boolean;
  response: object;
}

export enum PostStatus {
  UNKNOWN = "unknown",
  UNSCHEDULED = "unscheduled",
  SCHEDULED = "scheduled",
  PUBLISHED = "published",
  FAILED = "failed",
}
