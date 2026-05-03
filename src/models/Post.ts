import { FileGroup, FileInfo, PostStatus, PostResult } from "../types/index.ts";
import User from "./User.ts";
import Source from "./Source.ts";
import Platform from "./Platform.ts";
import { isSimilarArray } from "../utilities.ts";
import PostMapper from "../mappers/PostMapper.ts";

/**
 * Post - a post within a source
 *
 * A post belongs to both one platform and one source;
 * it is *prepared* and later *published* by the platform.
 * The post serializes to a json file in the source,
 * where it can be read later for further processing.
 *
 * The post does not actually handle files; it handles
 * its index which is finally written to disk. It does
 * read the file contents and check if the files
 * actually exist. If you want to add files to a post,
 * copy them in place yourself (in your platform class)
 * and add it to the post using methods below.
 */
export default class Post {
  id: string;
  user: User;
  source: Source;
  platform: Platform;
  valid: boolean = false;
  status: PostStatus = PostStatus.UNKNOWN;
  originalStatus: PostStatus = PostStatus.UNKNOWN;
  prepared: boolean = false;
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

  /**
   * Dont call the constructor yourself;
   * instead, call `await PostFactory.resolve()`
   * @param platform
   * @param source
   */
  constructor(platform: Platform, source: Source) {
    if (platform.user !== source.feed.user) {
      source.feed.user.log.error(
        "Creating source post from wrong platform",
        platform.id,
        source.id,
      );
      throw platform.user.log.error(
        "Creating platform post from wrong source",
        platform.id,
        source.id,
      );
    }
    this.user = platform.user;
    this.id = platform.getPostId(source);
    this.platform = platform;
    this.source = source;
    this.mapper = new PostMapper(this);
  }

  /**
   * Save this post to disk
   */

  async save() {
    this.user.log.trace("Post", "save");
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const data = { ...this } as { [key: string]: any };
    delete data.user;
    delete data.source;
    delete data.platform;
    delete data.mapper;
    delete data.prepared;
    delete data.originalStatus;
    await this.user.files.write(
      this.platform.getPostFilePath(this.source),
      JSON.stringify(data, null, "\t"),
    );

    if (this.originalStatus !== this.status) {
      // update the source status if necessary
      // note, this may *move* the source and all posts in it
      const originalSourceStage = this.source.stage;
      const newSourceStage = await this.source.updateStage();

      // update the users report
      const report = await this.user.getReport();
      if (report.platforms[this.platform.id]) {
        if (!report.platforms[this.platform.id]?.count[this.originalStatus]) {
          report.platforms[this.platform.id]!.count[this.originalStatus] = 1;
        }
        if (!report.platforms[this.platform.id]?.count[this.status]) {
          report.platforms[this.platform.id]!.count[this.status] = 0;
        }
        report.platforms[this.platform.id]!.count[this.originalStatus]!--;
        report.platforms[this.platform.id]!.count[this.status]!++;

        if (originalSourceStage !== newSourceStage) {
          if (!report.feed.count[originalSourceStage]) {
            report.feed.count[originalSourceStage] = 1;
          }
          if (!report.feed.count[newSourceStage]) {
            report.feed.count[newSourceStage] = 0;
          }
          report.feed.count[originalSourceStage]!--;
          report.feed.count[newSourceStage]!++;
        }
        // save the report
        await this.user.putReport(report);
        this.user.log.trace("Post", this.id, "save", "updated user report");
      }
      // all up to date
      this.originalStatus = this.status;
    }
  }

  /**
   * Prepare this post
   *
   * The post may already be prepared before,
   * but then things may have changed.
   *
   * If the is published, ignores it.
   * If the is failed, sets it back to
   * unscheduled.
   *
   * always updates the files, they may have changed
   * on disk; but also maintains some properties that may have
   * been changed manually
   *
   * Finally, Calls platform.preparePost()
   * Does not save the post.
   */

  async prepare() {
    this.user.log.trace("Post", "prepare");

    if (this.status === PostStatus.PUBLISHED) {
      return;
    }

    // purge non-existing files and
    // update existing files

    if (!this.prepared) {
      const assetsPath = this.getFilePath(this.platform.assetsFolder);
      if (!(await this.user.files.exists(assetsPath))) {
        await this.user.files.mkdir(assetsPath);
      }
    } else {
      await this.purgeFiles();
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
      this.body = await this.user.files.readFile(this.getFilePath("body.txt"));
    } else if (textFiles.length === 1) {
      const bodyFile = textFiles[0].name;
      this.body = await this.user.files.readFile(this.getFilePath(bodyFile));
    } else {
      this.body = this.platform.defaultBody;
    }

    if (this.hasFile("title.txt")) {
      this.title = await this.user.files.readFile(
        this.getFilePath("title.txt"),
      );
    } else if (this.hasFile("subject.txt")) {
      this.title = await this.user.files.readFile(
        this.getFilePath("subject.txt"),
      );
    }

    if (this.hasFile("tags.txt")) {
      this.tags = (
        await this.user.files.readFile(this.getFilePath("tags.txt"))
      ).split(/\s/);
    }
    if (this.hasFile("mentions.txt")) {
      this.mentions = this.mentions = (
        await this.user.files.readFile(this.getFilePath("mentions.txt"))
      ).split(/\s/);
    }
    if (this.hasFile("geo.txt")) {
      this.geo = await this.user.files.readFile(this.getFilePath("geo.txt"));
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

    await this.platform.preparePost(this);

    await this.save();
  }

  /**
   * Change this posts status and save it
   *
   * this just sets the status to whatever given; also updates
   * or removes published and scheduled dates to match
   * @param status - the status to change it to
   */

  async setStatus(status: PostStatus) {
    this.user.log.trace("Post", "setStatus", status);
    if (!this.prepared) {
      throw this.user.log.error("Post is not prepared");
    }
    if (!this.valid) {
      throw this.user.log.error("Post is not valid");
    }

    if (this.status === status) {
      throw this.user.log.error("Post already on status " + status);
    }
    this.user.log.warn("Changing post status to " + status);
    switch (status) {
      case PostStatus.UNSCHEDULED:
        this.user.log.warn("Removing scheduled and published dates");
        delete this.scheduled;
        delete this.published;
        break;
      case PostStatus.SCHEDULED:
        this.user.log.warn(
          "Resetting scheduled date, removing published date, r",
        );
        this.scheduled = this.scheduled || new Date();
        delete this.published;
        break;
      case PostStatus.PUBLISHED:
        this.user.log.warn("Resetting scheduled and published dates");
        this.scheduled = this.scheduled || new Date();
        this.published = this.published || new Date();
        break;
    }
    this.status = status;
    await this.save();
  }

  /**
   * Schedule this post and save it
   *
   * this just sets the 'scheduled' date
   * @param date - the date to schedule it on
   */

  async schedule(date: Date) {
    this.user.log.trace("Post", "schedule", date);
    if (!this.prepared) {
      throw this.user.log.error("Post is not prepared");
    }
    if (!this.valid) {
      throw this.user.log.error("Post is not valid");
    }
    if (this.status === PostStatus.CANCELED) {
      throw this.user.log.error("Post has status canceled");
    }
    if (this.status !== PostStatus.UNSCHEDULED) {
      this.user.log.warn("Rescheduling post");
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
    this.user.log.trace("Post", "publish");
    if (!this.prepared) {
      throw this.user.log.error("Post is not prepared");
    }
    if (!this.valid) {
      throw this.user.log.error("Post is not valid", this.id);
    }
    if (this.status === PostStatus.CANCELED) {
      throw this.user.log.error("Post has status canceled", this.id);
    }
    if (this.published) {
      throw this.user.log.error("Post was already published", this.id);
    }
    // why ?
    // if (!dryrun) post.schedule(now);
    this.user.log.info("Publishing", this.id);
    return await this.platform.publishPost(this, dryrun);
  }

  /**
   * Check body for title, #tags, \@mentions and %geo
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
      if (file.original && !(await this.user.files.exists(file.original))) {
        this.user.log.info(
          "Post",
          "purgeFiles",
          "purging non-existant derivate",
          file.name,
        );
        this.removeFile(file.name);
      }
      if (!(await this.user.files.exists(this.getFilePath(file.name)))) {
        this.user.log.info(
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
      this.user.log.trace("Post.addFile", newFile);
      this.files.push(newFile);
      return newFile;
    } else {
      this.user.log.warn("Post.addFile", "Not replacing existing file", name);
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
    this.user.log.trace("Post.replaceFile", search, replace);
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
      this.user.log.warn("Post.replaceFile", "metadata not found", search);
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
      this.user.log.warn(
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
}

export class PostFactory {
  static async resolve(platform: Platform, source: Source): Promise<Post> {
    const post = new Post(platform, source);
    const postFilePath = platform.getPostFilePath(source);
    if (!(await platform.user.files.exists(postFilePath))) {
      // post doesnt exist yet - tis a new post
      return post;
    }
    const contents = await platform.user.files.readFile(postFilePath);
    const data = JSON.parse(contents);
    if (!data) {
      throw platform.user.log.error(
        "Cant parse post ",
        post.id,
        post.source.id,
      );
    }
    Object.assign(post, data);
    post.id = platform.getPostId(source);
    post.prepared = true;
    post.scheduled = post.scheduled ? new Date(post.scheduled) : undefined;
    post.published = post.published ? new Date(post.published) : undefined;
    post.ignoreFiles = post.ignoreFiles ?? [];
    post.originalStatus = post.status;
    return post;
  }
}
