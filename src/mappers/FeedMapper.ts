import AbstractMapper from "./AbstractMapper";
import { Dto, FieldMapping } from "./AbstractMapper";
import Operator from "../models/Operator";
import Feed from "../models/Feed";

interface UserDto extends Dto {
  id?: string;
  homedir?: string;
}

export default class FeedMapper extends AbstractMapper {
  private feed: Feed;
  mapping: FieldMapping = {
    id: {
      type: "string",
      label: "ID",
      get: ["any"],
      set: ["none"],
      required: true,
    },
    path: {
      type: "string",
      label: "Path",
      get: ["none"],
      set: ["none"],
      required: true,
    },
    platforms: {
      type: "string[]",
      label: "Enabled platforms",
      get: ["manageFeed"],
      set: ["manageFeed"],
      required: false,
    },
    sources: {
      type: "string[]",
      label: "Feed sources",
      get: ["manageFeed"],
      set: ["none"],
      required: false,
    },
    interval: {
      type: "float",
      label: "Post interval",
      get: ["manageFeed"],
      set: ["manageFeed"],
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
  getDto(operator: Operator): UserDto {
    const fields = this.getDtoFields(operator, "get");
    const dto: UserDto = {};
    fields.forEach((field) => {
      switch (field) {
        case "id":
          dto[field] = this.feed.id;
          break;
        case "path":
          dto[field] = this.feed.path;
          break;
        case "platforms":
          dto[field] = Object.keys(this.feed.platforms);
          break;
        case "sources":
          dto[field] = this.feed.getSources().map((s) => s.id);
          break;
        case "interval":
          dto[field] = this.feed.interval;
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
  setDto(operator: Operator, dto: Dto): boolean {
    const fields = this.getDtoFields(operator, "set");
    Object.keys(dto).forEach((field) => {
      if (field in fields) {
        switch (field) {
          case "platforms":
            this.user.set(
              "settings",
              "FEED_PLATFORMS",
              (dto[field] as string[]).join(","),
            );
            break;
          case "interval":
            this.user.set("settings", "FEED_INTERVAL", dto[field] as string);
            break;
        }
      } else {
        throw this.user.error("Unknown field: " + field);
      }
    });
    return true;
  }
}
