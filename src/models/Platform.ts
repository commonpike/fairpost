import * as fs from "fs";
import * as pluginClasses from "../plugins";
import { PlatformId } from "../platforms";
import PlatformMapper from "../mappers/PlatformMapper";
import { FieldMapping } from "../mappers/AbstractMapper";

import Source, { FileGroup } from "./Source";

import Plugin from "./Plugin";
import Post from "./Post";
import { PostStatus } from "./Post";
import User from "./User";

/**
 * Platform base class to extend all platforms on
 *
 * When extending, implement at least
 * preparePost() and publishPost()
 */
export default class Platform {
  id: PlatformId = PlatformId.UNKNOWN;
  active: boolean = false;
  user: User;
  defaultBody: string = "Fairpost feed";
  assetsFolder: string = "_fairpost";
  postFileName: string = "post.json";
  mapper: PlatformMapper;
  settings: FieldMapping = {};
  interval: number;
  constructor(user: User) {
    this.user = user;
    this.id = (this.constructor as typeof Platform).id();
    this.interval = Number(this.user.get("settings", "FEED_INTERVAL", "7"));
    this.mapper = new PlatformMapper(this);
  }

  /**
   * Return the id of this platform as used in settings.
   * By default, this is the lowercase name of the class,
   * but you can override this in your own platform.
   * @returns the id
   */
  static id(): PlatformId {
    return this.name.toLowerCase() as PlatformId;
  }

  /**
   * setup
   *
   * Set the platform up. Get the required keys and tokens.
   * This may involve starting a webserver and/or communicating
   * via the CLI.
   * @returns - any object
   */
  async setup() {
    throw this.user.error(
      "No setup implemented for " +
        this.id +
        ". Read the docs in the docs folder.",
    );
  }

  /**
   * test
   *
   * Test the platform installation. This should not post
   * anything, but test access tokens et al. It can return
   * anything.
   * @returns - any object
   */
  async test(): Promise<unknown> {
    return "No tests implemented for " + this.id;
  }

  /**
   * refresh
   *
   * Refresh the platform installation. This usually refreshes
   * access tokens if required. It can throw errors
   * @returns - true if refreshed
   */
  async refresh(): Promise<boolean> {
    this.user.trace("Refresh not implemented for " + this.id);
    return false;
  }

  /**
   * getPostFilePath
   * @param source the source for the new or existing post
   * @returns the full path to the post file used
   * to store data for a post of this platform
   */
  getPostFilePath(source: Source): string {
    return source.path + "/" + this.assetsFolder + "/" + this.postFileName;
  }

  /**
   * getPost
   * @param source - the source to get the post for this platform from
   * @returns {Post} the post for this platform for the given source, if it exists.
   * @throws errors if the post does not exist or its data cant be read
   */

  getPost(source: Source): Post {
    this.user.trace(this.id, "getPost", this.id, source.id);

    const postFilePath = this.getPostFilePath(source);
    if (!fs.existsSync(postFilePath)) {
      throw this.user.error("No such post ", this.id, source.id);
    }
    const data = JSON.parse(fs.readFileSync(postFilePath, "utf8"));
    if (!data) {
      throw this.user.error("Cant parse post ", this.id, source.id);
    }
    return new Post(source, this, data);
  }

  /**
   * Get multiple (prepared) posts
   * @param sources - sources to filter on
   * @param status - post status to filter on
   * @returns multiple posts
   */
  getPosts(sources?: Source[], status?: PostStatus): Post[] {
    this.user.trace("User", "getPosts");
    const posts: Post[] = [];
    if (!sources) {
      sources = this.user.getFeed().getAllSources();
    }
    for (const source of sources) {
      try {
        const post = this.getPost(source);
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
   * Get last published post for a platform
   * @returns the above post or none
   */
  getLastPost(): Post | void {
    this.user.trace(this.id, "getLastPost");
    let lastPost: Post | undefined = undefined;
    const posts = this.getPosts(undefined, PostStatus.PUBLISHED);
    for (const post of posts) {
      if (post.published) {
        if (
          !lastPost ||
          !lastPost.published ||
          post.published >= lastPost.published
        ) {
          lastPost = post;
        }
      }
    }
    return lastPost;
  }

  /**
   * Get first post from sources scheduled in the past
   * @param sources
   * @returns the above post or none
   */
  getDuePost(sources: Source[]): Post | void {
    const now = new Date();
    for (const source of sources) {
      const post = this.getPost(source);
      if (post && post.status === PostStatus.SCHEDULED) {
        // some sanity checks
        if (!post.scheduled) {
          this.user.warn(
            "Found scheduled post without date. Unscheduling post.",
            post.id,
          );
          post.status = PostStatus.UNSCHEDULED;
          post.save();
          continue;
        }
        if (post.skip) {
          this.user.warn(
            "Found scheduled post marked skip. Unscheduling post.",
            post.id,
          );
          post.status = PostStatus.UNSCHEDULED;
          post.save();
          continue;
        }
        if (post.published) {
          this.user.warn(
            "Found scheduled post previously published. Marking published.",
            post.id,
          );
          post.status = PostStatus.PUBLISHED;
          post.save();
          continue;
        }
        if (post.scheduled <= now) {
          this.user.trace(
            "Feed",
            "publishDuePosts",
            post.id,
            "Posting; scheduled for",
            post.scheduled,
          );
          return post;
          break;
        } else {
          this.user.trace(
            "Feed",
            post.id,
            "Not due yet; scheduled for",
            post.scheduled,
          );
        }
      }
    }
  }
  /**
   * preparePost
   *
   * Prepare the post for this platform for the
   * given source, and save it. Optionally create
   * derivates of media and save those, too.
   *
   * If the post exists and is published, ignore.
   * If the post exists and is failed, set it back to
   * unscheduled.
   *
   * Do not throw errors. Instead, catch and log them,
   * and set the post.valid to false
   *
   * Presume the post may have already been prepared
   * before, and manually adapted later. For example,
   * post.skip may have manually been set to true.
   * @param source - the source for which to prepare a post for this platform
   * @returns the prepared post
   */
  async preparePost(source: Source): Promise<Post> {
    this.user.trace(this.id, "preparePost");
    let post: Post | undefined = undefined;
    try {
      post = this.getPost(source);
      if (post.status === PostStatus.PUBLISHED) {
        return post;
      }
      if (post.status === PostStatus.FAILED) {
        post.status = PostStatus.UNSCHEDULED;
      }
    } catch {
      post = new Post(source, this);
    }

    // some default logic. override this
    // in your own platform if you want;
    // but more likely, call super.preparePost
    // before adding your own logic.

    // always update the files, they may have changed
    // on disk; but also maintain some properties that may have
    // been changed manually

    post.purgeFiles();
    const files = await source.getFiles();
    files.forEach((file) => {
      if (post && !post.ignoreFiles?.includes(file.name)) {
        post.putFile(file);
      }
    });
    post.reorderFiles();

    // read textfiles and stick their contents
    // into appropriate properties - body, title, etc

    const textFiles = post.getFiles(FileGroup.TEXT);

    if (post.hasFile("body.txt")) {
      post.body = fs.readFileSync(post.source.path + "/body.txt", "utf8");
    } else if (textFiles.length === 1) {
      const bodyFile = textFiles[0].name;
      post.body = fs.readFileSync(post.source.path + "/" + bodyFile, "utf8");
    } else {
      post.body = this.defaultBody;
    }

    if (post.hasFile("title.txt")) {
      post.title = fs.readFileSync(post.source.path + "/title.txt", "utf8");
    } else if (post.hasFile("subject.txt")) {
      post.title = fs.readFileSync(post.source.path + "/subject.txt", "utf8");
    }

    if (post.hasFile("tags.txt")) {
      post.tags = fs
        .readFileSync(post.source.path + "/tags.txt", "utf8")
        .split(/\s/);
    }
    if (post.hasFile("mentions.txt")) {
      post.mentions = fs
        .readFileSync(post.source.path + "/mentions.txt", "utf8")
        .split(/\s/);
    }
    if (post.hasFile("geo.txt")) {
      post.geo = fs.readFileSync(post.source.path + "/geo.txt", "utf8");
    }

    // decompile the body to see if there are
    // appropriate metadata in there - title, tags, ..

    post.decompileBody();

    // validate and set status

    if (post.title) {
      post.valid = true;
    }

    if (post.status === PostStatus.UNKNOWN) {
      post.status = PostStatus.UNSCHEDULED;
    }

    // save
    post.save();

    return post;
  }

  /**
   * Get the next date for a post to be published on this platform
   *
   * This would be FAIRPOST_INTERVAL days after the date
   * of the last post for that platform, or now.
   * @returns the next date
   */
  getNextPostDate(): Date {
    this.user.trace("Feed", "getNextPostDate");
    let nextDate = null;
    const lastPost = this.getLastPost();
    if (lastPost && lastPost.published) {
      nextDate = new Date(lastPost.published);
      nextDate.setDate(nextDate.getDate() + this.interval);
    } else {
      nextDate = new Date();
    }
    return nextDate;
  }

  /**
   * Schedule the first unscheduled post for this platforms
   *
   * within given sources are all sources,
   * finds the next post date and the first unscheduled post,
   * and schedules that post on that date
   * @param date - use date instead of the next post date
   * @param sources - paths to sources to filter on
   * @returns the next scheduled post or undefined if there are no posts to schedule
   */
  scheduleNextPost(date?: Date, sources?: Source[]): Post | undefined {
    this.user.trace(this.id, "scheduleNextPost");
    if (!sources) {
      sources = this.user.getFeed().getAllSources();
    }
    const scheduledPosts = this.getPosts(sources, PostStatus.SCHEDULED);
    if (scheduledPosts.length) {
      this.user.trace(this.id, "scheduleNextPost", "Already scheduled");
      return scheduledPosts[0];
    }
    const nextDate = date ? date : this.getNextPostDate();
    for (const source of sources) {
      const post = this.getPost(source);
      if (
        post &&
        post.valid &&
        !post.skip &&
        post.status === PostStatus.UNSCHEDULED
      ) {
        post.schedule(nextDate);
        return post;
      }
    }
    this.user.trace(this.id, "scheduleNextPost", "No post left to schedule");
  }

  /**
   * publishPost
   *
   * - publish the post for this platform, sync.
   * - when done, pass the result to post.processResult()
   *
   * do not throw errors, instead catch and log them, and
   * set the post to failed.
   * @returns {Promise} succes status
   */

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    this.user.trace(this.id, "publishPost", post.id, dryrun);
    return post.processResult("-99", "#undefined", {
      date: new Date(),
      dryrun: dryrun,
      success: false,
      response: {},
      error: new Error("publishing not implemented for " + this.id),
    });
  }

  /**
   * publishDuePost
   *
   * - publish the first post scheduled in the past for this platform.
   * @returns {Promise} the post or none
   */

  async publishDuePost(
    sources: Source[],
    dryrun: boolean = false,
  ): Promise<Post | undefined> {
    this.user.trace(this.id, "publishDuePost", dryrun);
    const post = this.getDuePost(sources);
    if (post) {
      await post.publish(dryrun);
      return post;
    }
  }

  /**
   * @returns array of instances of the plugins given with the settings given.
   */
  loadPlugins(pluginSettings: { [pluginid: string]: object }): Plugin[] {
    const plugins: Plugin[] = [];
    Object.values(pluginClasses).forEach((pluginClass) => {
      const pluginId = pluginClass.id();
      if (pluginId in pluginSettings) {
        plugins?.push(new pluginClass(pluginSettings[pluginId]));
      }
    });
    return plugins;
  }
}
