import { promises as fs } from "fs";

import Source, { FileGroup, FileInfo } from "./Source";

import Platform from "./Platform";
import { isSimilarArray } from "../utilities";
import PostMapper from "../mappers/PostMapper";

/**
 * Post - a post within a source
 *
 * A post belongs to one platform and one source;
 * it is *prepared* and later *published* by the platform.
 * The post serializes to a json file in the source,
 * where it can be read later for further processing.
 */
export default class Post {
  id: string;
  source: Source;
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
  mapper: PostMapper;

  constructor(platform: Platform, source: Source) {
    this.id = platform.getPostId(source);
    this.platform = platform;
    this.source = source;
    this.mapper = new PostMapper(this);
  }

  async load() {
    const postFilePath = this.platform.getPostFilePath(this.source);
    if (!(await this.fileExists(postFilePath))) {
      throw this.platform.user.error("No such post ", this.id, this.source.id);
    }
    const data = JSON.parse(await fs.readFile(postFilePath, "utf8"));
    if (!data) {
      throw this.platform.user.error(
        "Cant parse post ",
        this.id,
        this.source.id,
      );
    }
    Object.assign(this, data);
    this.scheduled = this.scheduled ? new Date(this.scheduled) : undefined;
    this.published = this.published ? new Date(this.published) : undefined;
    this.ignoreFiles = this.ignoreFiles ?? [];
  }

  /**
   * Save this post to disk
   */

  async save() {
    this.platform.user.trace("Post", "save");
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const data = { ...this } as { [key: string]: any };
    delete data.source;
    delete data.platform;
    delete data.mapper;
    await fs.writeFile(
      this.platform.getPostFilePath(this.source),
      JSON.stringify(data, null, "\t"),
    );
  }

  /**
   * Prepare this post
   *
   * Called from Platform.preparePost;
   *
   * The post may already be prepared before,
   * but then things may have changed.
   *
   * always updates the files, they may have changed
   * on disk; but also maintains some properties that may have
   * been changed manually
   *
   * Does not save the post.
   */

  async prepare(isnew: boolean) {
    this.platform.user.trace("Post", "prepare");

    // purge non-existing files and
    // update existing files

    if (!isnew) {
      await this.purgeFiles();
    } else {
      const assetsPath = this.getFilePath(this.platform.assetsFolder);
      if (!(await this.fileExists(assetsPath))) {
        await fs.mkdir(assetsPath, { recursive: true });
      }
    }

    // get all files and process them

    const files = await this.source.getFiles();
    files.forEach((file) => {
      if (!this.ignoreFiles?.includes(file.name)) {
        this.putFile(file);
      }
    });
    this.reorderFiles();

    // read textfiles and stick their contents
    // into appropriate properties - body, title, etc

    const textFiles = this.getFiles(FileGroup.TEXT);

    if (this.hasFile("body.txt")) {
      this.body = await fs.readFile(this.source.path + "/body.txt", "utf8");
    } else if (textFiles.length === 1) {
      const bodyFile = textFiles[0].name;
      this.body = await fs.readFile(this.source.path + "/" + bodyFile, "utf8");
    } else {
      this.body = this.platform.defaultBody;
    }

    if (this.hasFile("title.txt")) {
      this.title = await fs.readFile(this.source.path + "/title.txt", "utf8");
    } else if (this.hasFile("subject.txt")) {
      this.title = await fs.readFile(this.source.path + "/subject.txt", "utf8");
    }

    if (this.hasFile("tags.txt")) {
      this.tags = (
        await fs.readFile(this.source.path + "/tags.txt", "utf8")
      ).split(/\s/);
    }
    if (this.hasFile("mentions.txt")) {
      this.mentions = (
        await fs.readFile(this.source.path + "/mentions.txt", "utf8")
      ).split(/\s/);
    }
    if (this.hasFile("geo.txt")) {
      this.geo = await fs.readFile(this.source.path + "/geo.txt", "utf8");
    }

    // decompile the body to see if there are
    // appropriate metadata in there - title, tags, ..

    this.decompileBody();

    // validate and set status

    if (this.title) {
      this.valid = true;
    }

    if (this.status === PostStatus.UNKNOWN) {
      this.status = PostStatus.UNSCHEDULED;
    }
    if (this.status === PostStatus.FAILED) {
      this.status = PostStatus.UNSCHEDULED;
    }

    // done
  }

  /**
   * Schedule this post and save it
   *
   * this just sets the 'scheduled' date
   * @param date - the date to schedule it on
   */

  async schedule(date: Date) {
    this.platform.user.trace("Post", "schedule", date);
    if (!this.valid) {
      throw this.platform.user.error("Post is not valid");
    }
    if (this.skip) {
      throw this.platform.user.error("Post is marked to be skipped");
    }
    if (this.status !== PostStatus.UNSCHEDULED) {
      this.platform.user.warn("Rescheduling post");
    }
    this.scheduled = date;
    this.status = PostStatus.SCHEDULED;
    await this.save();
  }

  /**
   * Publish this post and return it
   *
   * The post itself is a fixed entity and does not
   * know how to publish itself, so it calls on its
   * parent, in userland, to perform the logic.
   * @param dryrun - wether or not to really really publish it
   * @returns boolean if success
   */
  async publish(dryrun: boolean): Promise<boolean> {
    this.platform.user.trace("Post", "publish");
    if (!this.valid) {
      throw this.platform.user.error("Post is not valid", this.id);
    }
    if (this.skip) {
      throw this.platform.user.error("Post is marked skip", this.id);
    }
    if (this.published) {
      throw this.platform.user.error("Post was already published", this.id);
    }
    // why ?
    // if (!dryrun) post.schedule(now);
    this.platform.user.info("Publishing", this.id);
    return await this.platform.publishPost(this, dryrun);
  }

  /**
   * Check body for title, #tags, @mentions and %geo
   * and store those in separate fields instead.
   * Does not save.
   */
  decompileBody() {
    const lines = this.body?.trim().split("\n") ?? [];

    // chop title
    const title = lines[0];
    if (!this.title || this.title === title) {
      this.title = title ?? "";
      lines.shift();
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
      line = lines.pop() ?? "";

      if (!line.trim()) {
        this.body = lines.join("\n");
        continue;
      }

      if (line.match(rxtags)) {
        const tags = line.match(rxtag);
        if (tags && (!this.tags?.length || isSimilarArray(tags, this.tags))) {
          this.tags = tags;
          this.body = lines.join("\n");
        }
        continue;
      }

      if (line.match(rxmentions)) {
        const mentions = line.match(rxmention);
        if (
          mentions &&
          (!this.mentions?.length || isSimilarArray(mentions, this.mentions))
        ) {
          this.mentions = mentions;
          this.body = lines.join("\n");
        }
        continue;
      }

      if (line.match(rxgeo)) {
        const geo = line.match(rxgeo)?.[1] ?? "";
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
   * Create a body containing the given arguments.
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
  getGroupedFiles(): { [group in FileGroup]?: FileInfo[] } {
    return (
      this.files?.reduce(function (
        collector: { [group in FileGroup]?: FileInfo[] },
        file: FileInfo,
      ) {
        (collector[file["group"]] = collector[file["group"]] || []).push(file);
        return collector;
      }, {}) ?? {}
    );
  }

  /**
   * @param groups - names of groups to return files from
   * @returns the files within those groups, sorted by order
   */
  getFiles(...groups: FileGroup[]): FileInfo[] {
    if (!groups.length) {
      return this.files?.sort((a, b) => a.order - b.order) ?? [];
    }
    return (
      this.files
        ?.filter((file) => groups.includes(file.group))
        .sort((a, b) => a.order - b.order) ?? []
    );
  }

  /**
   * @param groups - names of groups to require files from
   * @returns boolean if files in post
   */
  hasFiles(...groups: FileGroup[]): boolean {
    if (!groups.length) {
      return !!(this.files?.length ?? 0);
    }
    return !!(
      this.files?.filter((file) => groups.includes(file.group)).length ?? 0
    );
  }

  /**
   * @param group - the name of the group for which to remove the files
   * Does not save.
   */
  removeFiles(group: FileGroup) {
    this.files = this.files?.filter((file) => file.group !== group);
  }

  /**
   * @param group - the name of the group for which to remove some files
   * @param size - the number of files to leave in the group
   */
  limitFiles(group: FileGroup, size: number) {
    this.getFiles(group).forEach((file, index) => {
      if (index >= size) {
        this.removeFile(file.name);
      }
    });
  }

  /**
   * Remove all the files that do not exist (anymore).
   * Does not save.
   */
  async purgeFiles() {
    for (const file of this.getFiles()) {
      if (
        file.original &&
        !(await this.fileExists(this.getFilePath(file.original)))
      ) {
        this.platform.user.info(
          "Post",
          "purgeFiles",
          "purging non-existant derivate",
          file.name,
        );
        this.removeFile(file.name);
      }
      if (!(await this.fileExists(this.getFilePath(file.name)))) {
        this.platform.user.info(
          "Post",
          "purgeFiles",
          "purging non-existent file",
          file.name,
        );
        this.removeFile(file.name);
      }
    }
  }

  /**
   * reindex file ordering to remove doubles.
   * Does not save.
   */
  reorderFiles() {
    this.files
      ?.sort((a, b) => a.order - b.order)
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
    return this.files?.find((file) => file.name === name);
  }

  /**
   * Add the file info of file `name` to the files of
   * this post. Returns undefined if it already exists.
   *
   * Does not save.
   * @param name - the name of the file to add
   * @returns the info of the added file
   */
  async addFile(name: string): Promise<FileInfo | undefined> {
    const index = this.files?.findIndex((file) => file.name === name) ?? -1;
    if (index === -1) {
      const newFile = await this.source.getFileInfo(
        name,
        this.files?.length ?? 0,
      );
      if (!this.files) {
        this.files = [];
      }
      this.platform.user.trace("Post.addFile", newFile);
      this.files.push(newFile);
      return newFile;
    } else {
      this.platform.user.warn(
        "Post.addFile",
        "Not replacing existing file",
        name,
      );
    }
  }

  /**
   * @param file - the fileinfo to add or replace.
   * Does not save.
   */
  putFile(file: FileInfo) {
    const oldFile = this.files?.find(
      (oldfile) => oldfile.name === file.name || oldfile.original === file.name,
    );
    if (oldFile) {
      file.order = oldFile.order;
      this.removeFile(oldFile.name);
    }
    if (!this.files) this.files = [];
    this.files.push(file);
  }

  /**
   * @param name the name of the file to remove.
   * Does not save.
   */
  removeFile(name: string) {
    this.files = this.files?.filter((file) => file.name !== name);
  }

  /**
   * Replace the file info of file `search` for new info
   * gathered for file `replace`. Keeps the oldfile order
   * and sets replace.original to search.name
   *
   * Does not save.
   * @param search - the name of the file to replace
   * @param replace - the name of the file to replace it with
   * @returns the info of the replaced file
   */
  async replaceFile(
    search: string,
    replace: string,
  ): Promise<FileInfo | undefined> {
    this.platform.user.trace("Post.replaceFile", search, replace);
    const index = this.files?.findIndex((file) => file.name === search) ?? -1;
    if (index > -1) {
      const oldFile = this.getFile(search);
      if (this.files && oldFile) {
        const newFile = await this.source.getFileInfo(replace, oldFile.order);
        newFile.original = oldFile.name;
        this.files[index] = newFile;
        return this.files[index];
      }
    } else {
      this.platform.user.warn("Post.replaceFile", "metadata not found", search);
    }
  }

  /**
   * @param name relative path in this post.source
   * @returns the full path to that file
   */
  getFilePath(name: string): string {
    return this.source.path + "/" + name;
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

  async processResult(
    remoteId: string,
    link: string,
    result: PostResult,
  ): Promise<boolean> {
    this.results.push(result);

    if (result.error) {
      this.platform.user.warn(
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

    await this.save();
    return result.success;
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
    } catch {
      return false;
    }
    return true;
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
