import AbstractMapper from "./AbstractMapper.ts";
import { SourceDto, FieldMapping, FileInfo } from "../types/index.ts";
import Operator from "../models/Operator.ts";
import Source from "../models/Source.ts";

export default class SourceMapper extends AbstractMapper<SourceDto> {
  private source: Source;
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
    stage: {
      type: "string",
      label: "Stage",
      get: ["manageSources"],
      set: ["none"],
    },
    path: {
      type: "string",
      label: "Path",
      get: ["manageSources"],
      set: ["none"],
    },
    files: {
      type: "json",
      label: "Files",
      get: ["manageSources"],
      set: ["manageSources"],
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
  async getDto(operator: Operator): Promise<SourceDto> {
    const fields = this.getDtoFields(operator, "get");
    const dto: SourceDto = {
      user_id: this.user.id,
      model: "source",
      id: this.source.id,
    };
    for (const field of fields) {
      switch (field) {
        case "model":
          dto[field] = "source";
          break;
        case "id":
          dto[field] = this.source.id;
          break;
        case "user_id":
          dto[field] = this.user.id;
          break;
        case "feed_id":
          dto[field] = this.source.feed.id;
          break;
        case "stage":
          dto[field] = this.source.stage;
          break;
        case "path":
          dto[field] = this.source.path;
          break;
        case "files":
          dto[field] = await this.source.getFiles();
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
  async putDto(operator: Operator, dto: SourceDto): Promise<boolean> {
    const fields = this.getDtoFields(operator, "set");
    for (const field in dto) {
      if (fields.includes(field)) {
        switch (field) {
          // upload here ?
          case "files":
            this.source.files = (dto[field] as FileInfo[]) ?? [];
            break;
        }
      } else {
        this.user.log.trace("Ignoring field: " + field);
      }
    }
    return true;
  }
}
