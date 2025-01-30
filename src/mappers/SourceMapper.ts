import AbstractMapper from "./AbstractMapper";
import { Dto, FieldMapping } from "./AbstractMapper";
import Operator from "../models/Operator";
import Source from "../models/Source";

interface SourceDto extends Dto {
  id?: string;
  user_id?: string;
  feed_id?: string;
  path?: string;
}

export default class SourceMapper extends AbstractMapper {
  private source: Source;
  mapping: FieldMapping = {
    id: {
      type: "string",
      label: "ID",
      get: ["manageSources"],
      set: ["none"],
    },
    user_id: {
      type: "string",
      label: "User ID",
      get: ["manageSources"],
      set: ["none"],
    },
    feed_id: {
      type: "string",
      label: "Feed ID",
      get: ["manageSources"],
      set: ["none"],
    },
    path: {
      type: "string",
      label: "Path",
      get: ["manageSources"],
      set: ["none"],
    },
  };

  constructor(source: Source) {
    super(source.feed.user);
    this.source = source;
  }

  /**
   * Return a dto based on the operator and operation
   * @param operator
   * @returns key/value pairs for the dto
   */
  getDto(operator: Operator): SourceDto {
    const fields = this.getDtoFields(operator, "get");
    const dto: SourceDto = {};
    fields.forEach((field) => {
      switch (field) {
        case "id":
          dto[field] = this.source.id;
          break;
        case "user_id":
          dto[field] = this.user.id;
          break;
        case "feed_id":
          dto[field] = this.source.feed.id;
          break;
        case "path":
          dto[field] = this.source.path;
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
  setDto(operator: Operator, dto: SourceDto): boolean {
    const fields = this.getDtoFields(operator, "set");
    for (const field in dto) {
      if (field in fields) {
        // no fields are settable yet. upload here ?
      } else {
        throw this.user.error("Unknown field: " + field);
      }
    }
    return true;
  }
}
