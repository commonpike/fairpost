import * as fs from "fs";

import Folder from "./Folder";
import Logger from "../services/Logger";
import Platform from "./Platform";

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
  status: PostStatus = PostStatus.UNKNOWN;
  scheduled?: Date;
  published?: Date;
  results: PostResult[] = [];
  title: string = "";
  body?: string;
  tags?: string;
  files?: {
    text: string[];
    image: string[];
    video: string[];
    other: string[];
  };
  link?: string;

  constructor(folder: Folder, platform: Platform, data?: object) {
    this.folder = folder;
    this.platform = platform;
    this.id = this.folder.id + ":" + this.platform.id;
    if (data) {
      Object.assign(this, data);
      this.scheduled = this.scheduled ? new Date(this.scheduled) : undefined;
      this.published = this.published ? new Date(this.published) : undefined;
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
      this.folder.path + "/" + this.platform.getPostFileName(),
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
