import * as pluginClasses from "../plugins";
import { PlatformId } from "../platforms";
import PlatformMapper from "../mappers/PlatformMapper";
import { FieldMapping } from "../mappers/AbstractMapper";

import Source from "./Source";

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
   * @returns {Post} the post for this platform for the given source, if it exists.
   * @throws errors if the post does not exist or its data cant be read
   */

  async getPost(source: Source): Promise<Post> {
    this.user.trace(this.id, "getPost", this.id, source.id);

    const postId = this.getPostId(source);
    if (!(postId in this.cache)) {
      const post = new Post(this, source);
      await post.load(); // or throw an error
      this.cache[postId] = post;
    }
    return this.cache[postId];
  }

  /**
   * Get multiple (prepared) posts
   * @param sources - sources to filter on
   * @param status - post status to filter on
   * @returns multiple posts
   */
  async getPosts(sources?: Source[], status?: PostStatus): Promise<Post[]> {
    this.user.trace(this.id, "getPosts");
    const posts: Post[] = [];
    if (!sources) {
      sources = await this.user.getFeed().getAllSources();
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
   * Get last published post for a platform
   * @returns the above post or none
   */
  async getLastPost(): Promise<Post | void> {
    this.user.trace(this.id, "getLastPost");
    let lastPost: Post | undefined = undefined;
    const posts = await this.getPosts(undefined, PostStatus.PUBLISHED);
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
  async getDuePost(sources: Source[]): Promise<Post | void> {
    const now = new Date();
    for (const source of sources) {
      const post = await this.getPost(source);
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
    this.user.trace(this.id, "preparePost");
    let post: Post | undefined = undefined;
    try {
      post = await this.getPost(source);
      if (post.status === PostStatus.PUBLISHED) {
        return post;
      }
      await post.prepare(false);
    } catch {
      post = new Post(this, source);
      await post.prepare(true);
      this.cache[post.id] = post;
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
   * @returns the next date
   */
  async getNextPostDate(): Promise<Date> {
    this.user.trace("Feed", "getNextPostDate");
    let nextDate = null;
    const lastPost = await this.getLastPost();
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
  async scheduleNextPost(
    date?: Date,
    sources?: Source[],
  ): Promise<Post | undefined> {
    this.user.trace(this.id, "scheduleNextPost");
    if (!sources) {
      sources = await this.user.getFeed().getAllSources();
    }
    const scheduledPosts = await this.getPosts(sources, PostStatus.SCHEDULED);
    if (scheduledPosts.length) {
      this.user.trace(this.id, "scheduleNextPost", "Already scheduled");
      return scheduledPosts[0];
    }
    const nextDate = date ? date : await this.getNextPostDate();
    for (const source of sources) {
      const post = await this.getPost(source);
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
    this.user.trace(this.id, "publishDuePost", dryrun);
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
