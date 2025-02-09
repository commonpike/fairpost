import AbstractMapper from "./AbstractMapper";
import { Dto, FieldMapping } from "./AbstractMapper";
import Operator from "../models/Operator";
import Feed from "../models/Feed";

export interface FeedDto
  extends Dto<{
    model?: string;
    id?: string;
    user_id?: string;
    path?: string;
    sources?: string[];
  }> {}

export default class FeedMapper extends AbstractMapper<FeedDto> {
  private feed: Feed;
  mapping: FieldMapping = {
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
    const dto: FeedDto = {};
    fields.forEach(async (field) => {
      switch (field) {
        case "model":
          dto[field] = "feed";
          break;
        case "id":
          dto[field] = this.feed.id;
          break;
        case "user_id":
          dto[field] = this.user.id;
          break;
        case "path":
          dto[field] = this.feed.path;
          break;
        case "sources":
          dto[field] = (await this.feed.getSources()).map((s) => s.id);
          break;
      }
    });
    return dto;
  }

  /**
   * Insert a given dto based on the operator
   * @param operator
   * @param dto
   * @returns boolean success
   */
  async setDto(operator: Operator, dto: FeedDto): Promise<boolean> {
    const fields = this.getDtoFields(operator, "set");
    for (const field in dto) {
      if (field in fields) {
        // there are no settable fields
      } else {
        throw this.user.error("Unknown field: " + field);
      }
    }
    return true;
  }
}
