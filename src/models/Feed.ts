import FeedMapper from "../mappers/FeedMapper.ts";
import Source from "./Source.ts";
import { SourceStatus } from "../types/index.ts";
import User from "./User.ts";
import { basename } from "path";

/**
 * Feed - the sources handler of fairpost
 *
 * The feed is a container of sources. The sources
 * path is set by USER_FEEDPATH. In it are subfolder
 * for every source status. Every dir in those subfolders,
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
  allCached: {
    [status in SourceStatus]?: boolean;
  } = {};
  mapper: FeedMapper;

  constructor(user: User) {
    this.user = user;
    this.path = this.user.data.get("settings", "USER_FEEDPATH", "feed");
    this.id = this.user.id + ":feed";
    this.mapper = new FeedMapper(this);
  }

  clearCache() {
    this.user.log.trace("Feed", "clearCache");
    this.cache = {};
    this.allCached = {};
  }

  /**
   * Get a report for this feed. This is
   * part of the user report, which is updated
   * as posts are processed and then cached
   * @returns a report for this feed
   */
  async getReport() {
    // TODO check report cache first
    const sources = {
      [SourceStatus.UNKNOWN]: 0,
      [SourceStatus.INCOMING]: 0,
      [SourceStatus.PENDING]: 0,
      [SourceStatus.ACTIVE]: 0,
      [SourceStatus.DONE]: 0,
      [SourceStatus.ARCHIVED]: 0,
    };
    const allSources = await this.getSources();
    for (const source of allSources) {
      const status = source.status;
      sources[status] = sources[status] + 1;
    }

    return {
      lastId: "todo",
      nextId: "todo",
      count: sources,
    };
  }

  /**
   * get source id based on the path of a source
   * @param path the path for the new or existing source
   * @returns the id for the new or existing source
   */
  getSourceId(path: string): string {
    return basename(path); // ah, simple
  }

  /**
   * Get all sources
   * @param sourceIds array of ids of source you want to get
   * @param status optional status of the sources you want to get
   * @returns all source in the feed
   */
  async getSources(
    sourceIds?: string[],
    status?: SourceStatus,
  ): Promise<Source[]> {
    this.user.log.trace("Feed", "getSources", sourceIds ?? "", status ?? "");
    if (!sourceIds || !sourceIds.length) {
      if (!status) {
        // requesting all sources
        if (!(await this.user.files.exists(this.path))) {
          this.user.log.info("creating dir " + this.path);
          await this.user.files.mkdir(this.path);
        }
        await Promise.all(
          Object.values(SourceStatus).map((status) =>
            this.getSources([], status),
          ),
        );
        // should all be in the cache now
        this.user.log.trace(
          "found " + Object.keys(this.cache).length + " sources",
        );
        return Object.values(this.cache);
      } else {
        // requesting sources with a specific status
        if (this.allCached[status]) {
          return Object.values(this.cache).filter(
            (source) => source.status === status,
          );
        }
        const statusPath = this.path + "/" + status;
        if (!(await this.user.files.exists(statusPath))) {
          return [];
        }
        const sources: Source[] = [];
        const files = this.user.files.list(statusPath).filter((entry) => {
          if (entry.type === "file" || entry.isFile) return false;
          const filename = basename(entry.path);
          if (filename.startsWith("_")) return false;
          if (filename.startsWith(".")) return false;
          return true;
        });
        for await (const file of files) {
          const source = await Source.getSource(this, basename(file.path));
          this.cache[source.id] = source;
          sources.push(source);
        }
        this.allCached[status] = true;
        this.user.log.trace(
          "found " + sources.length + " sources of status " + status,
        );
        return sources;
      }
    } else {
      // requesting sources with specific ids and optionally status
      const sources: Source[] = [];
      for (const sourceId of sourceIds) {
        if (sourceId in this.cache) {
          sources.push(this.cache[sourceId]);
        } else {
          const source = await Source.getSource(this, sourceId);
          this.cache[source.id] = source;
          sources.push(source);
        }
      }
      this.user.log.trace("found " + sources.length + " sources");
      if (!status) {
        return sources;
      }
      const filteredSources = sources.filter(
        (source) => source.status === status,
      );
      this.user.log.trace(
        "found " + filteredSources.length + " sources of status " + status,
      );
      return filteredSources;
    }
  }

  /**
   * Get one source
   * @param id - id of a single source
   * @returns the given source object
   */
  async getSource(id: string): Promise<Source> {
    this.user.log.trace("Feed", "getSource", id);
    if (id in this.cache) {
      return this.cache[id];
    }
    const source = await Source.getSource(this, id);
    this.cache[source.id] = source;
    return source;
  }
}
