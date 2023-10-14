
import * as fs from 'fs';
import Logger from './Logger';
import Folder from "./Folder";
import Platform from "./Platform";

export default class Post {
  folder: Folder;
  platform: Platform;
  valid: boolean = false;
  status: PostStatus = PostStatus.UNKNOWN;
  scheduled?: Date;
  published?: Date;
  results: {}[] = [];
  title: string = '';
  body?: string;
  tags?: string;
  files?: {
    text: string[],
    image: string[],
    video: string[],
    other: string[]
  };

  constructor(folder: Folder, platform: Platform, data?: any) {
    this.folder = folder;
    this.platform = platform;
    if (data) {
      Object.assign(this, data);
      this.scheduled = data.scheduled ? new Date(data.scheduled): undefined;
      this.published = data.published ? new Date(data.published): undefined;
    }
  }


  /*
  * save
  *
  * Save this post for this platform for the
  * given folder.
  */

  save(): void {
    Logger.trace('Post','save');
    const data = { ...this};
    delete data.folder;
    delete data.platform;
    fs.writeFileSync(
      this.folder.path+'/'+this.platform.getPostFileName(),
      JSON.stringify(data,null,"\t")
    );
  }

  schedule(date:Date): void {
    Logger.trace('Post','schedule');
    this.scheduled = date;
    this.status = PostStatus.SCHEDULED;
    this.save();
  }

  report(): string {
    Logger.trace('Post','report');
    let report = '';
    report += '\nPost: '+this.platform.id+' : '+this.folder.id;
    report += '\n - valid: '+this.valid;
    report += '\n - status: '+this.status;
    report += '\n - scheduled: '+this.scheduled;
    report += '\n - published: '+this.published;
    return report;
  }

}

export enum PostStatus {
    UNKNOWN = "unknown",
    UNSCHEDULED = "unscheduled",
    SCHEDULED = "scheduled",
    PUBLISHED = "published",
    FAILED = "failed"
}

