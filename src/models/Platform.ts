import * as pluginClasses from "../plugins/index.ts";
import { PlatformId } from "../platforms/index.ts";
import PlatformMapper from "../mappers/PlatformMapper.ts";
import { FieldMapping, SourceStage, PostStatus } from "../types/index.ts";

import Source from "./Source.ts";
import Plugin from "./Plugin.ts";
import Post from "./Post.ts";
import User from "./User.ts";

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
  cache: { [id: string]: Post } = {};
  defaultBody: string = "Fairpost feed";
  assetsFolder: string = "_fairpost";
  postFileName: string = "post.json";
  mapper: PlatformMapper;
  settings: FieldMapping = {};
  interval: number;
  constructor(user: User) {
    this.user = user;
    this.id = (this.constructor as typeof Platform).id();
    this.interval = Number(
      this.user.data.get("settings", "FEED_INTERVAL", "7"),
    );
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
    throw this.user.log.error(
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
    this.user.log.trace("Platform", "Refresh not implemented for " + this.id);
    return false;
  }

  /**
   * Get a report for this feed. This is
   * part of the user report which is updated
   * while the posts are being processed
   * and then cached.
   * @returns a report for this platform
   */
  async getReport() {
    this.user.log.trace("Platform", this.id, "getReport");
    // todo : check the cache first
    const posts = {
      [PostStatus.UNKNOWN]: 0,
      [PostStatus.CANCELED]: 0,
      [PostStatus.FAILED]: 0,
      [PostStatus.UNSCHEDULED]: 0,
      [PostStatus.SCHEDULED]: 0,
      [PostStatus.PUBLISHED]: 0,
    };
    const allPosts = await this.getPosts();
    for (const post of allPosts) {
      posts[post.status] = posts[post.status] + 1;
    }
    return {
      link: "todo",
      count: posts,
      lastId: "todo",
      lastLink: "todo",
      nextId: "todo",
    };
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
   * getPostId
   * @param source the source for the new or existing post
   * @returns the id for the new or existing post
   */
  getPostId(source: Source): string {
    return source.id + ":" + this.id;
  }
  /**
   * getPost
   * @param source - the source to get the post for this platform from
   * @returns {Post} the post for this platform for the given source
   */

  async getPost(source: Source): Promise<Post> {
    const postId = this.getPostId(source);
    if (!(postId in this.cache)) {
      this.user.log.trace("Platform", this.id, "getPost", source.id);
      const post = await Post.getPost(this, source);
      this.cache[postId] = post;
    }
    return this.cache[postId];
  }

  /**
   * Get multiple (prepared) posts. by default, if no sources are
   * given, it excludes posts from archived and incoming sources.
   * @param sources - sources to filter on
   * @param status - post status to filter on
   * @param stage - if no sources are given, the stage to filter al sources on
   * @returns multiple posts
   */
  async getPosts(
    sources?: Source[],
    status?: PostStatus,
    stage?: SourceStage,
  ): Promise<Post[]> {
    this.user.log.trace("Platform", this.id, "getPosts");
    const posts: Post[] = [];
    if (!sources) {
      sources = await this.user.getFeed().getSources([], stage);
      const stages = stage
        ? [stage]
        : Object.values(SourceStage).filter(
            (v) => v !== SourceStage.ARCHIVED && v !== SourceStage.INCOMING,
          );
      const feed = this.user.getFeed();
      sources = (
        await Promise.all(stages.map((stage) => feed.getSources([], stage)))
      ).flat();
    }
    for (const source of sources) {
      try {
        const post = await this.getPost(source);
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
   * Get last published post for a platform (by default
   * only from active and finished sources)
   * @param includeAll - whether to include posts from archived and incoming sources
   * @returns the above post or none
   */
  async getLastPost(includeAll = false): Promise<Post | void> {
    this.user.log.trace("Platform", this.id, "getLastPost");
    let lastPost: Post | undefined = undefined;
    const stages = includeAll
      ? Object.values(SourceStage)
      : [SourceStage.ACTIVE, SourceStage.FINISHED];
    const feed = this.user.getFeed();
    const sources = (
      await Promise.all(stages.map((stage) => feed.getSources([], stage)))
    ).flat();
    const posts = await this.getPosts(sources, PostStatus.PUBLISHED);
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
   * This also does some janitor checks ..
   * - if a post is scheduled without a date, it will be unscheduled
   * - if a post is already published, it will be marked as such
   * - if a post is marked as skip, it will be unscheduled
   * @param sources
   * @returns the above post or none
   */
  async getDuePost(sources: Source[]): Promise<Post | void> {
    const now = new Date();
    for (const source of sources) {
      const post = await this.getPost(source);
      if (post && post.status === PostStatus.SCHEDULED) {
        // TODO: some janitor checks
        if (!post.scheduled) {
          this.user.log.warn(
            "Found scheduled post without date. Unscheduling post.",
            post.id,
          );
          post.status = PostStatus.UNSCHEDULED;
          await post.save();
          continue;
        }
        if (post.skip) {
          this.user.log.warn(
            "Found scheduled post marked skip. Unscheduling post.",
            post.id,
          );
          post.status = PostStatus.UNSCHEDULED;
          await post.save();
          continue;
        }
        if (post.published) {
          this.user.log.warn(
            "Found scheduled post previously published. Marking published.",
            post.id,
          );
          post.status = PostStatus.PUBLISHED;
          await post.save();
          continue;
        }
        if (post.scheduled <= now) {
          this.user.log.trace(
            "Platform",
            this.id,
            "publishDuePosts",
            post.id,
            "Posting; scheduled for",
            post.scheduled,
          );
          return post;
          break;
        } else {
          this.user.log.trace(
            "Platform",
            this.id,
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
   * Prepare a post for this platform for the
   * given source. If it doesn't exist, create it.
   *
   * Override this in your own platform, but
   * always call super.preparePost()
   *
   * If the post exists and is published, ignores it.
   * If the post exists and is failed, sets it back to
   * unscheduled.
   *
   * Do not throw errors. Instead, catch and log them,
   * and set the post.valid to false
   *
   * Presume the post may have already been prepared
   * before, and manually adapted later. For example,
   * post.skip may have manually been set to true.
   * @param source - the source for which to prepare a post for this platform
   * @param save - wether to save the post already
   * @returns the prepared post
   */
  async preparePost(source: Source, save?: true): Promise<Post> {
    this.user.log.trace("Platform", this.id, "preparePost");
    const post = await this.getPost(source);
    if (post.status === PostStatus.PUBLISHED) {
      return post;
    }
    await post.prepare();
    if (post.status === PostStatus.UNKNOWN) {
      post.status = PostStatus.UNSCHEDULED;
    }
    if (post.status === PostStatus.FAILED) {
      post.status = PostStatus.UNSCHEDULED;
    }
    if (save) {
      await post.save();
    }

    return post;
  }

  /**
   * Get the next date for a post to be published on this platform
   *
   * This would be FAIRPOST_INTERVAL days after the date
   * of the last post for that platform, or now.
   * @param includeAll - whether to check for published posts from incoming, pending and archived sources
   * @returns the next date
   */
  async getNextPostDate(includeAll = false): Promise<Date> {
    this.user.log.trace("Feed", "getNextPostDate");
    let nextDate = null;
    const lastPost = await this.getLastPost(includeAll);
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
   * If no sources are given, searches for sources in
   * pending and active stages, or all if includeAll is given.
   *
   * If no date is given, finds the last post date within pending,
   * active and finished sources, or all if includeAll is given.
   * and calculates the next date based on that.
   *
   * within given sources, if there is a scheduled post, returns that one.
   * else, finds the first unscheduled post, and schedules that post on
   * the next date.
   * @param date - use date instead of the next post date
   * @param sources - paths to sources to filter on
   * @param includeAll - whether to consider incoming, finished and archived sources for last post date and unscheduled posts
   * @returns the next scheduled post or undefined if there are no posts to schedule
   */
  async scheduleNextPost(
    date?: Date,
    sources?: Source[],
    includeAll: boolean = false,
  ): Promise<Post | undefined> {
    this.user.log.trace("Platform", this.id, "scheduleNextPost");
    if (!sources) {
      // by default, only check pending and active sources
      const stages = includeAll
        ? Object.values(SourceStage)
        : [SourceStage.PENDING, SourceStage.ACTIVE];
      const feed = this.user.getFeed();
      sources = (
        await Promise.all(stages.map((stage) => feed.getSources([], stage)))
      ).flat();
    }
    const scheduledPosts = await this.getPosts(sources, PostStatus.SCHEDULED);
    if (scheduledPosts.length) {
      this.user.log.trace(
        "Platform",
        this.id,
        "scheduleNextPost",
        "Already scheduled",
      );
      return scheduledPosts[0];
    }
    // by default, only check pending, active and finished sources
    const nextDate = date ? date : await this.getNextPostDate(includeAll);
    for (const source of sources) {
      const post = await this.getPost(source);
      if (
        post &&
        post.valid &&
        !post.skip &&
        post.status === PostStatus.UNSCHEDULED
      ) {
        await post.schedule(nextDate);
        return post;
      }
    }
    this.user.log.trace(
      this.id,
      "scheduleNextPost",
      "No post left to schedule",
    );
  }

  /**
   * publishPost
   *
   * - your platform should implement this itself.
   * - publish the post for this platform, sync.
   * - when done, pass the result to post.processResult()
   *
   * do not throw errors, instead catch and log them, and
   * set the post to failed.
   * @returns {Promise} succes status
   */

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    this.user.log.trace("Platform", this.id, "publishPost", post.id, dryrun);
    return await post.processResult("-99", "#undefined", {
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
    this.user.log.trace("Platform", this.id, "publishDuePost", dryrun);
    const post = await this.getDuePost(sources);
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
