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
  allCached: {
    [stage in SourceStage]?: boolean;
  } = {};
  mapper: FeedMapper;

  constructor(user: User) {
    this.user = user;
    this.path = this.user.data.get("settings", "USER_FEEDPATH", "");
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
    // TODO check report cache first
    const sources = {
      [SourceStage.UNKNOWN]: 0,
      [SourceStage.INCOMING]: 0,
      [SourceStage.PENDING]: 0,
      [SourceStage.ACTIVE]: 0,
      [SourceStage.FINISHED]: 0,
      [SourceStage.ARCHIVED]: 0,
    };
    const currentSources = await this.getSources();
    const archivedSources = await this.getSources([], SourceStage.ARCHIVED);
    for (const source of [...currentSources, ...archivedSources]) {
      sources[source.stage] = sources[source.stage] + 1;
    }

    return {
      lastId: "todo",
      nextId: "todo",
      count: sources,
    };
  }

  public clearCache() {
    this.user.log.trace("Feed", "clearCache");
    this.cache = {};
    this.allCached = {};
  }

  /**
   * getStagePath
   *
   * Get the path for a stage in a feed
   * @param stage - the stage of the source
   * @returns the path to the folder for the stage
   */
  public getStagePath(stage: SourceStage): string {
    const stageFolder = stage.toLowerCase(); // todo: map from .env
    return this.path + "/" + stageFolder;
  }

  /**
   * Get multiple sources
   * @param sourceIds optional array of ids of source you want to get
   * @param stage optional stage of the sources you want to get
   * @param includeArchived if no stages and no sourceIds are given, archived is excluded by default
   * @returns all requested sources
   */
  async getSources(
    sourceIds?: string[],
    stage?: SourceStage,
    includeArchived = false,
  ): Promise<Source[]> {
    this.user.log.trace("Feed", "getSources", sourceIds ?? "", stage ?? "");
    if (!(await this.user.files.exists(this.path))) {
      this.user.log.info("creating dir " + this.path);
      await this.user.files.mkdir(this.path);
    }
    if (!sourceIds || !sourceIds.length) {
      if (!stage) {
        // requesting all sources
        const stages = includeArchived
          ? Object.values(SourceStage)
          : Object.values(SourceStage).filter(
              (v) => v !== SourceStage.ARCHIVED,
            );
        await Promise.all(stages.map((stage) => this.getSources([], stage)));
        // should all be in the cache now
        this.user.log.trace(
          "found " + Object.keys(this.cache).length + " sources",
        );
        return Object.values(this.cache);
      } else {
        // requesting sources with a specific status
        if (this.allCached[stage]) {
          return Object.values(this.cache).filter(
            (source) => source.stage === stage,
          );
        }
        const stagePath = this.getStagePath(stage);
        if (!(await this.user.files.exists(stagePath))) {
          return [];
        }
        const sources: Source[] = [];
        const files = (
          await this.user.files.list(stagePath).toArray(true)
        ).filter((entry) => {
          if (entry.type === "file" || entry.isFile) return false;
          const filename = basename(entry.path);
          if (filename.startsWith("_")) return false;
          if (filename.startsWith(".")) return false;
          return true;
        });

        for await (const file of files) {
          const sourceId = Source.getSourceId(file.path);
          const source = await this.getSource(sourceId);
          this.cache[source.id] = source;
          sources.push(source);
        }
        this.allCached[stage] = true;
        this.user.log.trace(
          "found " + sources.length + " sources of stage " + stage,
        );
        return sources;
      }
    } else {
      // requesting sources with specific ids and optionally stage
      const sources = await Promise.all(
        sourceIds.map((sourceId) => this.getSource(sourceId, stage)),
      );
      this.user.log.trace("found " + sources.length + " sources");
      return sources;
    }
  }
  /**
   * Get one source, and use a local cache.
   * @param id - id of the source
   * @param stage - optional stages to find the source in
   * @returns the given source object
   */
  async getSource(id: string, stage?: SourceStage): Promise<Source> {
    this.user.log.trace("Feed", "getSource", id, stage);
    if (id in this.cache) {
      return this.cache[id];
    }
    const stages = stage ? [stage] : Object.values(SourceStage);
    for (const stage of stages) {
      const sourcePath = Source.getSourcePath(this, id, stage);
      if (await this.user.files.isDir(sourcePath)) {
        const source = new Source(this, sourcePath);
        this.cache[source.id] = source;
        return source;
      }
    }
    throw this.user.log.error("getSource", "Source not found: " + id, stage);
  }
}
