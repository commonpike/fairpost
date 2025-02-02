import * as fs from "fs";

import FeedMapper from "../mappers/FeedMapper";
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
  sources: Source[] = [];
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
    this.path = this.user
      .get("settings", "USER_FEEDPATH", "users/%user%/feed")
      .replace("%user%", this.user.id);
    this.id = this.user.id + ":feed";
    this.mapper = new FeedMapper(this);
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
      this.sources = paths.map(
        (path) => new Source(this, this.path + "/" + path),
      );
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
    return new Source(this, this.path + "/" + path);
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
   
  getSourceStatus(path: string): PostStatus {
    this.user.trace("Feed", "getSourceStatus", path);
    const platforms = this.user.getPlatforms();
    const source = this.getSource(path);
    const posts = [] as Post[];
    platforms.forEach((p) => {
      posts.push(p.getPost(source));
    });
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
   */
}
