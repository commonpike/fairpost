import AbstractMapper from "./AbstractMapper.ts";
import { FeedDto, FieldMapping } from "../types/index.ts";
import Operator from "../models/Operator.ts";
import Feed from "../models/Feed.ts";

export default class FeedMapper extends AbstractMapper<FeedDto> {
  private feed: Feed;
  static feedMapping: FieldMapping = {
    model: {
      type: "string",
      label: "Model",
      get: ["any"],
      set: ["none"],
    },
    id: {
      type: "string",
      label: "ID",
      get: ["any"],
      set: ["none"],
    },
    user_id: {
      type: "string",
      label: "User ID",
      get: ["any"],
      set: ["none"],
    },
    path: {
      type: "string",
      label: "Path",
      get: ["manageFeed"],
      set: ["none"],
    },
    sources: {
      type: "string[]",
      label: "Feed sources",
      get: ["manageFeed"],
      set: ["none"],
      required: false,
    },
  };
  mapping = FeedMapper.feedMapping;

  constructor(feed: Feed) {
    super(feed.user);
    this.feed = feed;
  }

  /**
   * Return a dto based on the operator and operation
   * @param operator
   * @returns key/value pairs for the dto
   */
  async getDto(operator: Operator): Promise<FeedDto> {
    const fields = this.getDtoFields(operator, "get");
    const dto: FeedDto = {
      user_id: this.user.id,
      model: "feed",
      id: this.feed.id,
    };
    for (const field of fields) {
      switch (field) {
        case "path":
          dto[field] = this.feed.path;
          break;
        case "sources":
          dto[field] = (await this.feed.getSources()).map((s) => s.id);
          break;
      }
    }
    return dto;
  }

  /**
   * Insert a given dto based on the operator
   * @param operator
   * @param dto
   * @returns boolean success
   */
  async putDto(operator: Operator, dto: FeedDto): Promise<boolean> {
    const fields = this.getDtoFields(operator, "set");
    for (const field in dto) {
      if (fields.includes(field)) {
        // there are no settable fields
      } else {
        this.user.log.trace("Ignoring field: " + field);
      }
    }
    return true;
  }
}
