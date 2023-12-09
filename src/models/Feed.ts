import * as fs from "fs";

import Folder from "./Folder";
import Logger from "../services/Logger";
import Platform from "./Platform";
import { PlatformId } from "../platforms";
import Post from "./Post";
import { PostStatus } from "./Post";
import Storage from "../services/Storage";

/**
 * Feed - the core handler of fairpost
 *
 * You start a feed with a config, by default .env, which
 * defines the feed folder and platform settings. From the feed,
 * you are able to get platforms, folders and posts, and
 * manage and publish those.
 */
export default class Feed {
  id: string = "";
  path: string = "";
  platforms: {
    [id in PlatformId]?: Platform;
  } = {};
  folders: Folder[] = [];
  interval: number;

  /**
   * The constructor reads the dotenv file, then reads all
   * the classes in the platform folder and assumes their filenames
   * are the names of their constructor.
   * From platforms/index.ts, if the platform is exported there,
   * it constructs it and if that platform is enabled
   * in the feed config, the platform is added to the feed.
   * @param configPath - path to file for dotenv to parse
   */

  constructor(platforms: Platform[]) {
    platforms.forEach((p) => (this.platforms[p.id] = p));
    this.path = Storage.get("settings", "FEED_PATH");
    this.id = this.path;
    this.interval = Number(Storage.get("settings", "FEED_INTERVAL", "7"));
  }

  /**
   * Return a small report for this feed
   * @returns the report in text
   */

  report(): string {
    Logger.trace("Feed", "report");
    let report = "";
    report += "\nFeed: " + this.id;
    report += "\n - path: " + this.path;
    report += "\n - platforms: " + Object.keys(this.platforms).join();
    report +=
      "\n - folders: " +
      this.getFolders()
        .map((f) => f.path)
        .join();
    return report;
  }

  /**
   * Set up one platform
   * @param platformId - the slug of the platform
   * @returns the setup result
   */
  async setupPlatform(platformId: PlatformId): Promise<unknown> {
    Logger.trace("Feed", "setupPlatform", platformId);
    const platform = this.getPlatform(platformId);
    return await platform.setup();
  }

  /**
   * Set up more platforms
   * @param platformsIds - the slugs of the platforms
   * @returns the setup results indexed by platform ids
   */
  async setupPlatforms(
    platformsIds?: PlatformId[],
  ): Promise<{ [id: string]: unknown }> {
    Logger.trace("Feed", "setupPlatforms", platformsIds);
    const results = {};
    for (const platformId of platformsIds ??
      (Object.keys(this.platforms) as PlatformId[])) {
      results[platformId] = await this.setupPlatform(platformId);
    }
    return results;
  }

  /**
   * Get one platform
   * @param platformId - the slug of the platform
   * @returns platform given by id
   */
  getPlatform(platformId: PlatformId): Platform {
    Logger.trace("Feed", "getPlatform", platformId);
    const platform = this.platforms[platformId];
    if (!platform) {
      throw Logger.error("Unknown platform: " + platformId);
    }
    return platform;
  }

  /**
   * Get multiple platforms
   * @param platformIds - the slug of the platform
   * @returns platforms given by ids
   */
  getPlatforms(platformIds?: PlatformId[]): Platform[] {
    Logger.trace("Feed", "getPlatforms", platformIds);
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
    Logger.trace("Feed", "testPlatform", platformId);
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
    Logger.trace("Feed", "testPlatforms", platformsIds);
    const results = {};
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
    Logger.trace("Feed", "refreshPlatform", platformId);
    return await this.getPlatform(platformId).refresh();
  }

  /**
   * Refresh multiple platforms
   * @param platformsIds - the slugs of the platforms
   * @returns the refresh results indexed by platform ids
   */
  async refreshPlatforms(
    platformsIds?: PlatformId[],
  ): Promise<{ [id: string]: boolean }> {
    Logger.trace("Feed", "refreshPlatforms", platformsIds);
    const results = {};
    for (const platformId of platformsIds ??
      (Object.keys(this.platforms) as PlatformId[])) {
      results[platformId] = await this.refreshPlatform(platformId);
    }
    return results;
  }

  /**
   * Get all folders
   * @returns all folder in the feed
   */
  getAllFolders(): Folder[] {
    Logger.trace("Feed", "getAllFolders");
    if (this.folders.length) {
      return this.folders;
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
      this.folders = paths.map((path) => new Folder(this.path + "/" + path));
    }
    return this.folders;
  }

  /**
   * Get one folder
   * @param path - path to a single folder
   * @returns the given folder object
   */
  getFolder(path: string): Folder | undefined {
    Logger.trace("Feed", "getFolder", path);
    return this.getFolders([path])[0];
  }

  /**
   * Get multiple folders
   * @param paths - paths to multiple folders
   * @returns the given folder objects
   */
  getFolders(paths?: string[]): Folder[] {
    Logger.trace("Feed", "getFolders", paths);
    return (
      paths?.map((path) => new Folder(this.path + "/" + path)) ??
      this.getAllFolders()
    );
  }

  /**
   * Get one (prepared) post
   * @param path - path to a single folder
   * @param platformId - the platform for the post
   * @returns the given post, or undefined if not prepared
   */
  getPost(path: string, platformId: PlatformId): Post | undefined {
    Logger.trace("Feed", "getPost");
    return this.getPosts({ folders: [path], platforms: [platformId] })[0];
  }

  /**
   * Get multiple (prepared) posts
   * @param filters - object to filter posts by
   * @param filters.folders - paths to folders to filter on
   * @param filters.platforms - slugs to platforms to filter on
   * @param filters.status - post status to filter on
   * @returns multiple posts
   */
  getPosts(filters?: {
    folders?: string[];
    platforms?: PlatformId[];
    status?: PostStatus;
  }): Post[] {
    Logger.trace("Feed", "getPosts");
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const folders = this.getFolders(filters?.folders);
    for (const folder of folders) {
      for (const platform of platforms) {
        const post = platform.getPost(folder);
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
   * @param path - path to a single folder
   * @param platformId - the platform for the post
   * @returns the given post, or undefined if failed
   */
  async preparePost(
    path: string,
    platformId: PlatformId,
  ): Promise<Post | undefined> {
    Logger.trace("Feed", "preparePost", path, platformId);
    return (
      await this.preparePosts({ folders: [path], platforms: [platformId] })
    )[0];
  }

  /**
   * Prepare multiple posts
   * @param filters - object to filter posts by
   * @returns multiple posts
   */

  async preparePosts(filters?: {
    folders?: string[];
    platforms?: PlatformId[];
  }): Promise<Post[]> {
    Logger.trace("Feed", "preparePosts", filters);
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const folders = this.getFolders(filters?.folders);
    for (const folder of folders) {
      for (const platform of platforms) {
        const post = platform.getPost(folder);
        if (post?.status !== PostStatus.PUBLISHED) {
          const newPost = await platform.preparePost(folder);
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
   * @param path - path to a single folder
   * @param platformId - the platform for the post
   * @param date - Date to schedule post on
   * @returns the given post
   */
  schedulePost(path: string, platformId: PlatformId, date: Date): Post {
    Logger.trace("Feed", "schedulePost", path, platformId, date);
    const post = this.getPost(path, platformId);
    if (!post.valid) {
      throw Logger.error("Post is not valid");
    }
    if (post.status !== PostStatus.UNSCHEDULED) {
      throw Logger.error("Post is not unscheduled");
    }
    post.schedule(date);
    return post;
  }

  /**
   * Schedule multiple posts
   *
   * Note - this is for consistence only, it is actually unused
   * @param filters - object to filter posts by
   * @param filters.folders - paths to folders to filter on
   * @param filters.platforms - slugs to platforms to filter on
   * @param date - date to schedule posts on
   * @returns multiple posts
   */
  schedulePosts(
    filters: {
      folders?: string[];
      platforms?: PlatformId[];
    },
    date: Date,
  ): Post[] {
    Logger.trace("Feed", "schedulePosts", filters, date);
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const folders = this.getFolders(filters?.folders);
    for (const platform of platforms) {
      for (const folder of folders) {
        const post = platform.getPost(folder);
        if (!post.valid) {
          throw Logger.error("Post is not valid");
        }
        if (post.status !== PostStatus.UNSCHEDULED) {
          throw Logger.error("Post is not unscheduled");
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
   * Will publish the post regardless of its status
   * @param path - path to a single folder
   * @param platformId - the platform for the post
   * @param dryrun - wether or not to really publish
   * @returns the given post
   */

  async publishPost(
    path: string,
    platformId: PlatformId,
    dryrun: boolean = false,
  ): Promise<Post> {
    Logger.trace("Feed", "publishPost", path, platformId, dryrun);
    const now = new Date();
    const platform = this.getPlatform(platformId);
    const folder = this.getFolder(path);
    const post = platform.getPost(folder);
    if (post.valid) {
      if (!dryrun) post.schedule(now);
      Logger.info("Posting", platformId, path);
      await platform.publishPost(post, dryrun);
    } else {
      throw Logger.error("Post is not valid");
    }
    return post;
  }

  /**
   * Publish multiple posts
   *
   * Note - this is for consistence only, it is actually unused
   * @param filters - object to filter posts by
   * @param filters.folders - paths to folders to filter on
   * @param filters.platforms - slugs to platforms to filter on
   * @param dryrun - wether to really publish
   * @returns multiple posts
   */
  async publishPosts(
    filters?: {
      folders?: string[];
      platforms?: PlatformId[];
    },
    dryrun: boolean = false,
  ): Promise<Post[]> {
    Logger.trace("Feed", "publishPosts", filters, dryrun);
    const now = new Date();
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const folders = this.getFolders(filters?.folders);
    for (const platform of platforms) {
      for (const folder of folders) {
        const post = platform.getPost(folder);
        if (post.valid) {
          post.schedule(now);
          Logger.trace("Posting", platform.id, folder.id);
          await platform.publishPost(post, dryrun);
          posts.push(post);
        } else {
          Logger.warn("Skipping invalid post", platform.id, folder.id);
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
    Logger.trace("Feed", "getLastPost");
    let lastPost: Post = undefined;
    const posts = this.getPosts({
      platforms: [platformId],
      status: PostStatus.PUBLISHED,
    });
    for (const post of posts) {
      if (!lastPost || post.published >= lastPost.published) {
        lastPost = post;
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
    Logger.trace("Feed", "getNextPostDate");
    let nextDate = null;
    const lastPost = this.getLastPost(platformId);
    if (lastPost) {
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
   * for each platform, within given folders are all folders,
   * finds the next post date and the first unscheduled post,
   * and schedules that post on that date
   * @param date - use date instead of the next post date
   * @param filters - limit the process to certain platforms or folders
   * @param filters.folders - paths to folders to filter on
   * @param filters.platforms - slugs of platforms to filter on
   * @returns the scheduled posts
   */
  scheduleNextPosts(
    date?: Date,
    filters?: {
      folders?: string[];
      platforms?: PlatformId[];
    },
  ): Post[] {
    Logger.trace("Feed", "scheduleNextPosts");
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const folders = this.getFolders(filters?.folders);
    for (const platform of platforms) {
      const nextDate = date ? date : this.getNextPostDate(platform.id);
      for (const folder of folders) {
        const post = platform.getPost(folder);
        if (post.valid && post?.status === PostStatus.UNSCHEDULED) {
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
   * for each platform, within given folders or all folders,
   * find the first post that is scheduled in the past and
   * publish that.
   * @param filters - limit the process to certain platforms or folders
   * @param filters.folders - paths to folder to filter on
   * @param filters.platforms - slugs of platforms to filter on
   * @param dryrun - wether to really publish posts
   * @returns the published posts
   */
  async publishDuePosts(
    filters?: {
      folders?: string[];
      platforms?: PlatformId[];
    },
    dryrun: boolean = false,
  ): Promise<Post[]> {
    Logger.trace("Feed", "publishDuePosts");
    const now = new Date();
    const posts: Post[] = [];
    const platforms = this.getPlatforms(filters?.platforms);
    const folders = this.getFolders(filters?.folders);
    for (const platform of platforms) {
      for (const folder of folders) {
        const post = platform.getPost(folder);
        if (post?.status === PostStatus.SCHEDULED) {
          if (post.scheduled <= now) {
            console.log("Posting", platform.id, folder.id);
            await platform.publishPost(post, dryrun);
            posts.push(post);
            break;
          }
        }
      }
    }
    return posts;
  }
}
