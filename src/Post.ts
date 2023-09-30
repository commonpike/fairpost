
import * as fs from 'fs';
import * as path from 'path';
import Folder from "./Folder";
import Platform from "./Platform";

export default class Post {
  folder: Folder;
  platform: Platform;
  valid: boolean = false;
  status: PostStatus = PostStatus.UNKNOWN;
  scheduled?: Date;
  posted?: Date;
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
      this.posted = data.posted ? new Date(data.posted): undefined;
    }
  }


  /*
  * save
  *
  * Save this post for this platform for the
  * given folder.
  */

  save(): void {
    const data = { ...this};
    delete data.folder;
    delete data.platform;
    fs.writeFileSync(
      this.folder.path+'/'+this.platform.getPostFileName(),
      JSON.stringify(data,null,"\t")
    );
  }

  schedule(date:Date): void {
    this.scheduled = date;
    this.status = PostStatus.SCHEDULED;
    this.save();
  }

  report(): string {
    let report = '';
    report += '\nPost: '+this.platform.slug+' : '+this.folder.path;
    report += '\n - valid: '+this.valid;
    report += '\n - status: '+this.status;
    report += '\n - scheduled: '+this.scheduled;
    report += '\n - posted: '+this.posted;
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

