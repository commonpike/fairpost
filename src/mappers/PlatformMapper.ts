import AbstractMapper from "./AbstractMapper";
import { Dto, FieldMapping } from "./AbstractMapper";
import Operator from "../models/Operator";
import Platform from "../models/Platform";

export interface PlatformDto
  extends Dto<{
    model?: string;
    id?: string;
    user_id?: string;
    active?: boolean;
    // more fields added by platform
    [key: string]: string | string[] | number | boolean | undefined;
  }> {}

export default class PlatformMapper extends AbstractMapper<PlatformDto> {
  private platform: Platform;
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
      get: ["managePlatforms"],
      set: ["none"],
    },
    user_id: {
      type: "string",
      label: "User ID",
      get: ["managePlatforms"],
      set: ["none"],
    },
    active: {
      type: "boolean",
      label: "Active",
      get: ["managePlatforms"],
      set: ["managePlatforms"],
    },
    // more fields from platform.settings
    // added in constructor
  };

  constructor(platform: Platform) {
    super(platform.user);
    this.platform = platform;
    for (const key in platform.settings) {
      this.mapping[key] = platform.settings[key];
    }
  }

  /**
   * Return a dto based on the operator and operation
   * @param operator
   * @returns key/value pairs for the dto
   */
  getDto(operator: Operator): PlatformDto {
    const fields = this.getDtoFields(operator, "get");
    const dto: PlatformDto = {};
    fields.forEach((field) => {
      switch (field) {
        case "model":
          dto[field] = "platform";
          break;
        case "id":
          dto[field] = this.platform.id;
          break;
        case "user_id":
          dto[field] = this.user.id;
          break;
        case "active":
          dto[field] = !!this.platform.active;
          break;
        default:
          switch (this.mapping[field].type) {
            case "string":
              dto[field] = String(this.user.get("settings", field, ""));
              break;
            case "string[]":
              dto[field] = String(this.user.get("settings", field, "")).split(
                ",",
              );
              break;
            case "boolean":
              dto[field] = this.user.get("settings", field, "") === "true";
              break;
            case "integer":
              dto[field] = parseInt(this.user.get("settings", field, ""));
              break;
            case "float":
              dto[field] = parseFloat(this.user.get("settings", field, ""));
              break;
            case "json":
              if (this.mapping[field].default) {
                dto[field] = {
                  ...(this.mapping[field].default as object),
                  ...JSON.parse(this.user.get("settings", field, "{}")),
                };
              } else {
                dto[field] = JSON.parse(this.user.get("settings", field, "{}"));
              }
              break;
          }
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
  setDto(operator: Operator, dto: PlatformDto): boolean {
    const fields = this.getDtoFields(operator, "set");
    for (const field in dto) {
      if (field in fields) {
        switch (field) {
          case "active":
            dto[field]
              ? this.user.addPlatform(this.platform.id)
              : this.user.removePlatform(this.platform.id);
            break;
          default: {
            switch (this.mapping[field].type) {
              case "string":
              case "integer":
              case "float":
                this.user.set("settings", field, String(dto[field]));
                break;
              case "string[]":
                this.user.set(
                  "settings",
                  field,
                  (dto[field] as string[]).join(","),
                );
                break;
              case "boolean":
                this.user.set("settings", field, dto[field] ? "true" : "false");
                break;
              case "json":
                this.user.set("settings", field, JSON.stringify(dto[field]));
                break;
            }
          }
        }
      } else {
        throw this.user.error("Unknown field: " + field);
      }
    }
    return true;
  }
}
