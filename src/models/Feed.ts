import FeedMapper from "../mappers/FeedMapper.ts";
import Source from "./Source.ts";
import User from "./User.ts";
import { basename } from "path";

/**
 * Feed - the sources handler of fairpost
 *
 * The feed is a container of sources. The sources
 * path is set by USER_FEEDPATH. Every dir in there,
 * if not starting with _ or ., is a source.
 *
 * Every source can be prepared to become a post
 * for a platform; but it's the platform that handles that.
 */
export default class Feed {
  id: string = "";
  path: string = "";
  user: User;
  cache: { [id: string]: Source } = {};
  allCached: boolean = false;
  mapper: FeedMapper;

  constructor(user: User) {
    this.user = user;
    this.path = this.user.data.get("settings", "USER_FEEDPATH", "feed");
    this.id = this.user.id + ":feed";
    this.mapper = new FeedMapper(this);
  }

  /**
   * getSourceId
   * @param path the path for the new or existing source
   * @returns the id for the new or existing source
   */
  getSourceId(path: string): string {
    return basename(path); // ah, simple
  }

  /**
   * Get all sources
   * @returns all source in the feed
   */
  async getAllSources(): Promise<Source[]> {
    this.user.log.trace("Feed", "getAllSources");
    if (this.allCached) {
      return Object.values(this.cache);
    }
    if (!(await this.user.files.exists(this.path))) {
      this.user.log.info("creating dir " + this.path);
      await this.user.files.mkdir(this.path);
    }
    const files = this.user.files.list(this.path).filter((entry) => {
      if (entry.type === "file" || entry.isFile) return false;
      const filename = basename(entry.path);
      if (filename.startsWith("_")) return false;
      if (filename.startsWith(".")) return false;
      return true;
    });
    for await (const file of files) {
      const source = await Source.getSource(this, basename(file.path));
      this.cache[source.id] = source;
    }
    this.allCached = true;
    return Object.values(this.cache);
  }

  /**
   * Get one source
   * @param path - path to a single source
   * @returns the given source object
   */
  async getSource(path: string): Promise<Source> {
    this.user.log.trace("Feed", "getSource", path);
    const sourceId = this.getSourceId(path);
    if (sourceId in this.cache) {
      return this.cache[sourceId];
    }
    const source = await Source.getSource(this, path);
    this.cache[source.id] = source;
    return source;
  }

  /**
   * Get multiple sources
   * @param paths - paths to multiple sources
   * @returns the given source objects
   */
  async getSources(paths?: string[]): Promise<Source[]> {
    this.user.log.trace("Feed", "getSources", paths);
    if (!paths || !paths.length) {
      return await this.getAllSources();
    }
    return Promise.all(paths.map((path) => this.getSource(path)));
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
    this.user.log.trace("Feed", "getSourceStatus", path);
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
