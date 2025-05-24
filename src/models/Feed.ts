import FeedMapper from "../mappers/FeedMapper.ts";
import Source from "./Source.ts";
import { SourceStage } from "../types/index.ts";
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
   * Get a report for this feed. This is
   * part of the user report, which is updated
   * as posts are processed and then cached
   * @returns a report for this feed
   */
  async getReport() {
    // TODO check cache first
    const sources = {
      [SourceStage.UNKNOWN]: 0,
      [SourceStage.INCOMING]: 0,
      [SourceStage.PENDING]: 0,
      [SourceStage.ACTIVE]: 0,
      [SourceStage.FINISHED]: 0,
      [SourceStage.ARCHIVED]: 0,
    };
    const allSources = await this.getAllSources();
    for (const source of allSources) {
      const status = source.getSourceStage();
      sources[status] = sources[status] + 1;
    }

    return {
      lastId: "todo",
      nextId: "todo",
      count: sources,
    };
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
   * @param id - id of the source
   * @param stage - optional stage to find the source in
   * @returns the given source object
   */
  async getSource(id: string, stage?: SourceStage): Promise<Source> {
    this.user.log.trace("Feed", "getSource", id, stage);
    if (id in this.cache) {
      return this.cache[id];
    }
    const source = await Source.getSource(this, id, stage);
    this.cache[source.id] = source;
    return source;
  }

  /**
   * Get multiple sources
   * @param ids - ids of multiple sources
   * @returns the given source objects
   */
  async getSources(ids?: string[]): Promise<Source[]> {
    this.user.log.trace("Feed", "getSources", ids);
    if (!ids || !ids.length) {
      return await this.getAllSources();
    }
    return Promise.all(ids.map((id) => this.getSource(id)));
  }
}
