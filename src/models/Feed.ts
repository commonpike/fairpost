import * as fs from "fs";

import Platform from "./Platform";
import { PlatformId } from "../platforms";
import Post from "./Post";
import FeedMapper from "../mappers/FeedMapper";
import { PostStatus } from "./Post";
import Source from "./Source";
import User from "./User";

/**
 * Feed - the core handler of fairpost
 *
 * You start a feed with a config, by default .env, which
 * defines the feed folder and platform settings. From the feed,
 * you are able to get platforms, sources and posts, and
 * manage and publish those.
 */
export default class Feed {
  id: string = "";
  path: string = "";
  user: User;
  platforms: {
    [id in PlatformId]?: Platform;
  } = {};
  sources: Source[] = [];
  interval: number;
  mapper: FeedMapper;

  /**
   * The constructor reads the dotenv file, then reads all
   * the classes in the platform folder and assumes their filenames
   * are the names of their constructor.
   * From platforms/index.ts, if the platform is exported there,
   * it constructs it and if that platform is enabled
   * in the feed config, the platform is added to the feed.
   * @param configPath - path to file for dotenv to parse
   */

  constructor(user: User) {
    this.user = user;
    user.platforms
      .filter((p) => p.active)
      .forEach((p) => (this.platforms[p.id] = p));
    this.path = this.user
      .get("settings", "USER_FEEDPATH", "users/%user%/feed")
      .replace("%user%", this.user.id);
    this.id = this.user.id + ":feed";
    this.interval = Number(this.user.get("settings", "FEED_INTERVAL", "7"));
    this.mapper = new FeedMapper(this);
  }

  /**
   * Set up one platform
   * @param platformId - the slug of the platform
   * @returns object with properties success, test or error
   */
  async setupPlatform(platformId: PlatformId): Promise<unknown> {
    this.user.trace("Feed", "setupPlatform", platformId);
    const platform = this.getPlatform(platformId);
    try {
      await platform.setup();
      return {
        success: true,
        test: await platform.test(),
      };
    } catch (e) {
      if (e instanceof Error) {
        return {
          success: false,
          error: e.message,
        };
      } else {
        return {
          success: false,
          error: JSON.stringify(e),
        };
      }
    }
  }

  /**
   * Set up more platforms
   * @param platformsIds - the slugs of the platforms
   * @returns the setup results indexed by platform ids
   */
  async setupPlatforms(
    platformsIds?: PlatformId[],
  ): Promise<{ [id: string]: unknown }> {
    this.user.trace("Feed", "setupPlatforms", platformsIds);
    const results = {} as { [id: string]: unknown };
    for (const platformId of platformsIds ??
      (Object.keys(this.platforms) as PlatformId[])) {
      results[platformId] = this.setupPlatform(platformId);
    }
    return results;
  }

  /**
   * Get one platform
   * @param platformId - the slug of the platform
   * @returns platform given by id
   */
  getPlatform(platformId: PlatformId): Platform {
    this.user.trace("Feed", "getPlatform", platformId);
    const platform = this.platforms[platformId];
    if (!platform) {
      throw this.user.error("Unknown platform: " + platformId);
    }
    return platform;
  }

  /**
   * Get multiple platforms
   * @param platformIds - the slug of the platform
   * @returns platforms given by ids
   */
  getPlatforms(platformIds?: PlatformId[]): Platform[] {
    this.user.trace("Feed", "getPlatforms", platformIds);
    return platformIds
      ? platformIds.map((platformId) => this.getPlatform(platformId))
      : Object.values(this.platforms);
  }

  /**
   * Test one platform
   * @param platformId - the slug of the platform
   * @returns the test result
   */
  async testPlatform(platformId: PlatformId): Promise<unknown> {
    this.user.trace("Feed", "testPlatform", platformId);
    return await this.getPlatform(platformId).test();
  }

  /**
   * Test multiple platforms
   * @param platformsIds - the slugs of the platforms
   * @returns the test results indexed by platform ids
   */
  async testPlatforms(
    platformsIds?: PlatformId[],
  ): Promise<{ [id: string]: unknown }> {
    this.user.trace("Feed", "testPlatforms", platformsIds);
    const results = {} as { [id: string]: unknown };
    for (const platformId of platformsIds ??
      (Object.keys(this.platforms) as PlatformId[])) {
      results[platformId] = await this.testPlatform(platformId);
    }
    return results;
  }

  /**
   * Refresh one platform
   * @param platformId - the slug of the platform
   * @returns the refresh result
   */
  async refreshPlatform(platformId: PlatformId): Promise<boolean> {
    this.user.trace("Feed", "refreshPlatform", platformId);
    try {
      return await this.getPlatform(platformId).refresh();
    } catch (error) {
      this.user.error("Feed", "refreshPlatform", error);
      return false;
    }
  }

  /**
   * Refresh multiple platforms
   * @param platformsIds - the slugs of the platforms
   * @returns the refresh results indexed by platform ids
   */
  async refreshPlatforms(
    platformsIds?: PlatformId[],
  ): Promise<{ [id: string]: boolean }> {
    this.user.trace("Feed", "refreshPlatforms", platformsIds);
    const results = {} as { [id: string]: boolean };
    for (const platformId of platformsIds ??
      (Object.keys(this.platforms) as PlatformId[])) {
      results[platformId] = await this.refreshPlatform(platformId);
    }
    return results;
  }

  /**
   * Get all sources
   * @returns all source in the feed
   */
  getAllSources(): Source[] {
    this.user.trace("Feed", "getAllSources");
    if (this.sources.length) {
      return this.sources;
    }
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
    const paths = fs.readdirSync(this.path).filter((path) => {
      return (
        fs.statSync(this.path + "/" + path).isDirectory() &&
        !path.startsWith("_") &&
        !path.startsWith(".")
      );
    });
    if (paths) {
      this.sources = paths.map((path) => new Source(this.path + "/" + path));
    }
    return this.sources;
  }

  /**
   * Get one source
   * @param path - path to a single source
   * @returns the given source object
   */
  getSource(path: string): Source {
    this.user.trace("Feed", "getSource", path);
    return new Source(this.path + "/" + path);
  }

  /**
   * Get multiple sources
   * @param paths - paths to multiple sources
   * @returns the given source objects
   */
  getSources(paths?: string[]): Source[] {
    this.user.trace("Feed", "getSources", paths);
    return paths?.map((path) => this.getSource(path)) ?? this.getAllSources();
  }

  /**
   * Get one source status
   * @param path - path to a single source
   * @returns an amalgation of the sources post statusses
   *
   * if there are no posts, its unknown
   * if at least one post is failed, its failed
   * if at least one post is scheduled, its scheduled
   * if all posts are published, its published
   * otherwise its unscheduled
   */
  getSourceStatus(path: string): PostStatus {
    this.user.trace("Feed", "getSourceStatus", path);
    const posts = this.getPosts({ sources: [path] });
    if (!posts.length) {
      return PostStatus.UNKNOWN;
    }
    let haveScheduled = false;
    let haveFailed = false;
    let allPublished = true;
    for (const post of posts) {
      if (post.valid && !post.skip) {
        if (post.status === PostStatus.SCHEDULED) {
          haveScheduled = true;
        }
        if (post.status === PostStatus.FAILED) {
          haveFailed = true;
        }
        if (post.status !== PostStatus.PUBLISHED) {
          allPublished = false;
        }
      }
    }
    if (haveFailed) {
      return PostStatus.FAILED;
    }
    if (haveScheduled) {
      return PostStatus.SCHEDULED;
    }
    if (allPublished) {
      return PostStatus.PUBLISHED;
    }
    return PostStatus.UNSCHEDULED;
  }

  /**
   * Get one (prepared) post
   * @param path - path to a single source
   * @param platformId - the platform for the post
   * @returns the given post, or undefined if not prepared
   */
  getPost(path: string, platformId: PlatformId): Post | undefined {
    this.user.trace("Feed", "getPost");
    const platform = this.getPlatform(platformId);
    const source = this.getSource(path);
    return platform.getPost(source);
  }

  /**
   * Get multiple (prepared) posts
   * @param filters - object to filter posts by
   * @param filters.sources - paths to sources to filter on
   * @param filters.platforms - slugs to platforms to filter on
   * @param filters.status - post status to filter on
   * @returns multiple posts
   */
  getPosts(filters?: {
    sources?: string[];
    platforms?: PlatformId[];
    status?: PostStatus;
  }): Post[] {
    this.user.trace("Feed", "getPosts");
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const sources = this.getSources(filters?.sources);
    for (const source of sources) {
      for (const platform of platforms) {
        const post = platform.getPost(source);
        if (
          post &&
          (!filters?.status || filters.status.includes(post.status))
        ) {
          posts.push(post);
        }
      }
    }
    return posts;
  }

  /**
   * Prepare single post
   * @param path - path to a single source
   * @param platformId - the platform for the post
   * @returns the given post, or undefined if failed
   */
  async preparePost(
    path: string,
    platformId: PlatformId,
  ): Promise<Post | undefined> {
    this.user.trace("Feed", "preparePost", path, platformId);
    return (
      await this.preparePosts({ sources: [path], platforms: [platformId] })
    )[0];
  }

  /**
   * Prepare multiple posts
   * @param filters - object to filter posts by
   * @returns multiple posts
   */

  async preparePosts(filters?: {
    sources?: string[];
    platforms?: PlatformId[];
  }): Promise<Post[]> {
    this.user.trace("Feed", "preparePosts", filters);
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const sources = this.getSources(filters?.sources);
    for (const source of sources) {
      for (const platform of platforms) {
        const post = platform.getPost(source);
        if (post?.status !== PostStatus.PUBLISHED) {
          const newPost = await platform.preparePost(source);
          if (newPost) {
            posts.push(newPost);
          }
        }
      }
    }
    return posts;
  }

  /**
   * Schedule single post
   * @param path - path to a single source
   * @param platformId - the platform for the post
   * @param date - Date to schedule post on
   * @returns the given post
   */
  schedulePost(path: string, platformId: PlatformId, date: Date): Post {
    this.user.trace("Feed", "schedulePost", path, platformId, date);
    const post = this.getPost(path, platformId);
    if (!post) {
      throw this.user.error("Post not found");
    }
    if (!post.valid) {
      throw this.user.error("Post is not valid");
    }
    if (post.skip) {
      throw this.user.error("Post is marked to be skipped");
    }
    if (post.status !== PostStatus.UNSCHEDULED) {
      throw this.user.error("Post is not unscheduled");
    }
    post.schedule(date);
    return post;
  }

  /**
   * Schedule multiple posts
   *
   * Note - this is for consistence only, it is actually unused
   * @param filters - object to filter posts by
   * @param filters.sources - paths to sources to filter on
   * @param filters.platforms - slugs to platforms to filter on
   * @param date - date to schedule posts on
   * @returns multiple posts
   */
  schedulePosts(
    filters: {
      sources: string[];
      platforms?: PlatformId[];
    },
    date: Date,
  ): Post[] {
    this.user.trace("Feed", "schedulePosts", filters, date);
    if (!filters.sources) {
      if (!filters.platforms) {
        throw this.user.error(
          "Feed.schedulePosts needs to filter on either sources or platforms",
        );
      }
    }
    if (filters.sources && filters.sources.length > 1) {
      throw this.user.error(
        "Feed.schedulePosts will cowardly only operate on one source",
      );
    }
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const sources = this.getSources(filters?.sources);
    for (const source of sources) {
      for (const platform of platforms) {
        const post = platform.getPost(source);
        if (!post) {
          throw this.user.error("Post not found");
        }
        if (!post.valid) {
          this.user.warn("Feed", "schedulePosts", "Post is not valid");
          continue;
        }
        if (post.skip) {
          this.user.warn(
            "Feed",
            "schedulePosts",
            "Post is marked to be skipped",
          );
          continue;
        }
        if (post.status !== PostStatus.UNSCHEDULED) {
          this.user.warn("Feed", "schedulePosts", "Rescheduling post");
        }
        post.schedule(date);
        posts.push(post);
      }
    }
    return posts;
  }

  /**
   * Publish single post
   *
   * Will publish the post regardless of its status or skip
   * @param path - path to a single source
   * @param platformId - the platform for the post
   * @param dryrun - wether or not to really publish
   * @returns the given post
   */

  async publishPost(
    path: string,
    platformId: PlatformId,
    dryrun: boolean = false,
  ): Promise<Post> {
    this.user.trace("Feed", "publishPost", path, platformId, dryrun);
    const now = new Date();
    const platform = this.getPlatform(platformId);
    const source = this.getSource(path);
    if (!source) {
      throw this.user.error("Source not found", path);
    }
    const post = platform.getPost(source);
    if (!post) {
      throw this.user.error("Post not found", path, platformId);
    }
    if (!post.valid) {
      throw this.user.error("Post is not valid");
    }
    if (!dryrun) post.schedule(now);
    this.user.info("Posting", platformId, path);
    await platform.publishPost(post, dryrun);

    return post;
  }

  /**
   * Publish multiple posts
   *
   * Note - this is for consistence only, it is actually unused
   * @param filters - object to filter posts by
   * @param filters.sources - paths to sources to filter on
   * @param filters.platforms - slugs to platforms to filter on
   * @param dryrun - wether to really publish
   * @returns multiple posts
   */
  async publishPosts(
    filters: {
      sources: string[];
      platforms?: PlatformId[];
    },
    dryrun: boolean = false,
  ): Promise<Post[]> {
    this.user.trace("Feed", "publishPosts", filters, dryrun);
    if (!filters.sources) {
      if (!filters.platforms) {
        throw this.user.error(
          "Feed.schedulePosts needs to filter on either sources or platforms",
        );
      }
    }
    if (filters.sources && filters.sources.length > 1) {
      throw this.user.error(
        "Feed.schedulePosts will cowardly only operate on one source",
      );
    }
    const now = new Date();
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const sources = this.getSources(filters?.sources);
    for (const platform of platforms) {
      for (const source of sources) {
        const post = platform.getPost(source);
        if (post) {
          if (post.valid) {
            if (!post.skip) {
              post.schedule(now);
              this.user.trace("Posting", post.id);
              await platform.publishPost(post, dryrun);
              posts.push(post);
            } else {
              this.user.warn("Skipping post marked skip", post.id);
            }
          } else {
            this.user.warn("Skipping invalid post", post.id);
          }
        } else {
          this.user.warn("Skipping post not found", source.id, platform.id);
        }
      }
    }
    return posts;
  }

  /* --------------------
        feed planning 
  ----------------------- */

  /**
   * Get last published post for a platform
   * @param platformId - the platform for the post
   * @returns the given post or none
   */
  getLastPost(platformId: PlatformId): Post | void {
    this.user.trace("Feed", "getLastPost");
    let lastPost: Post | undefined = undefined;
    const posts = this.getPosts({
      platforms: [platformId],
      status: PostStatus.PUBLISHED,
    });
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
   * Get the next date for a post to be publshed on a platform
   *
   * This would be FAIRPOST_INTERVAL days after the date
   * of the last post for that platform, or now.
   * @param platformId - the platform for the post
   * @returns the next date
   */
  getNextPostDate(platformId: PlatformId): Date {
    this.user.trace("Feed", "getNextPostDate");
    let nextDate = null;
    const lastPost = this.getLastPost(platformId);
    if (lastPost && lastPost.published) {
      nextDate = new Date(lastPost.published);
      nextDate.setDate(nextDate.getDate() + this.interval);
    } else {
      nextDate = new Date();
    }
    return nextDate;
  }

  /**
   * Schedule the first unscheduled post for multiple platforms
   *
   * for each platform, within given sources are all sources,
   * finds the next post date and the first unscheduled post,
   * and schedules that post on that date
   * @param date - use date instead of the next post date
   * @param filters - limit the process to certain platforms or sources
   * @param filters.sources - paths to sources to filter on
   * @param filters.platforms - slugs of platforms to filter on
   * @returns the scheduled posts
   */
  scheduleNextPosts(
    date?: Date,
    filters?: {
      sources?: string[];
      platforms?: PlatformId[];
    },
  ): Post[] {
    this.user.trace("Feed", "scheduleNextPosts");
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const sources = this.getSources(filters?.sources);
    for (const platform of platforms) {
      const scheduledPosts = this.getPosts({
        platforms: [platform.id],
        status: PostStatus.SCHEDULED,
      });
      if (scheduledPosts.length) {
        this.user.trace(
          "Feed",
          "scheduleNextPosts",
          platform.id,
          "Already scheduled",
        );
        continue;
      }
      const nextDate = date ? date : this.getNextPostDate(platform.id);
      for (const source of sources) {
        const post = platform.getPost(source);
        if (
          post &&
          post.valid &&
          !post.skip &&
          post.status === PostStatus.UNSCHEDULED
        ) {
          post.schedule(nextDate);
          posts.push(post);
          break;
        }
      }
    }
    return posts;
  }

  /**
   * Publish scheduled posts, one for each platform
   *
   * for each platform, within given sources or all sources,
   * find the first post that is scheduled in the past and
   * publish that.
   * @param filters - limit the process to certain platforms or sources
   * @param filters.sources - paths to source to filter on
   * @param filters.platforms - slugs of platforms to filter on
   * @param dryrun - wether to really publish posts
   * @returns the published posts
   */
  async publishDuePosts(
    filters?: {
      sources?: string[];
      platforms?: PlatformId[];
    },
    dryrun: boolean = false,
  ): Promise<Post[]> {
    this.user.trace("Feed", "publishDuePosts");
    const now = new Date();
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const sources = this.getSources(filters?.sources);
    for (const platform of platforms) {
      for (const source of sources) {
        const post = platform.getPost(source);
        if (post && post.status === PostStatus.SCHEDULED) {
          if (!post.scheduled) {
            this.user.warn(
              "Not publishing scheduled post without date. Unscheduling post.",
              post.id,
            );
            post.status = PostStatus.UNSCHEDULED;
            post.save();
            continue;
          }
          if (post.skip) {
            this.user.warn(
              "Not publishing scheduled post marked skip. Unscheduling post.",
              post.id,
            );
            post.status = PostStatus.UNSCHEDULED;
            post.save();
            continue;
          }
          if (post.published) {
            this.user.warn(
              "Not publishing scheduled post previously published. Marking published.",
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
            await platform.publishPost(post, dryrun);
            posts.push(post);
            break;
          } else {
            this.user.trace(
              "Feed",
              post.id,
              "Not posting; scheduled for",
              post.scheduled,
            );
          }
        }
      }
    }
    return posts;
  }
}
