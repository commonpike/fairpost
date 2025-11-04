import AbstractMapper from "./AbstractMapper.ts";
import { PlatformDto, FieldMapping } from "../types/index.ts";
import Operator from "../models/Operator.ts";
import Platform from "../models/Platform.ts";

export default class PlatformMapper extends AbstractMapper<PlatformDto> {
  private platform: Platform;
  private static platformMapping: FieldMapping = {
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
    connected: {
      type: "boolean",
      label: "Connected",
      get: ["managePlatforms"],
      set: ["none"],
    },
    // more fields from platform.settings
    // added in mapper constructor
  };

  mapping = structuredClone(PlatformMapper.platformMapping);

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
  async getDto(operator: Operator): Promise<PlatformDto> {
    const fields = this.getDtoFields(operator, "get");
    const dto: PlatformDto = {
      user_id: this.user.id,
      model: "platform",
      id: this.platform.id,
    };
    for (const field of fields) {
      switch (field) {
        case "active":
          dto[field] = !!this.platform.active;
          break;
        case "connected":
          dto[field] = !!this.platform.connected;
          break;
        case "model":
        case "id":
        case "user_id":
          break;
        default:
          switch (this.mapping[field].type) {
            case "string":
              dto[field] = String(this.user.data.get("settings", field, ""));
              break;
            case "string[]":
              dto[field] = String(
                this.user.data.get("settings", field, ""),
              ).split(",");
              break;
            case "boolean":
              dto[field] = this.user.data.get("settings", field, "") === "true";
              break;
            case "integer":
              dto[field] = parseInt(this.user.data.get("settings", field, ""));
              break;
            case "float":
              dto[field] = parseFloat(
                this.user.data.get("settings", field, ""),
              );
              break;
            case "json":
              if (this.mapping[field].default) {
                dto[field] = {
                  ...(this.mapping[field].default as object),
                  ...JSON.parse(this.user.data.get("settings", field, "{}")),
                };
              } else {
                dto[field] = JSON.parse(
                  this.user.data.get("settings", field, "{}"),
                );
              }
              break;
          }
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
  async putDto(operator: Operator, dto: PlatformDto): Promise<boolean> {
    const fields = this.getDtoFields(operator, "set");
    for (const field in dto) {
      if (fields.includes(field)) {
        switch (field) {
          case "active":
            if (dto[field]) await this.user.addPlatform(this.platform.id);
            else await this.user.removePlatform(this.platform.id);
            break;
          default: {
            switch (this.mapping[field].type) {
              case "string":
              case "integer":
              case "float":
                this.user.data.set("settings", field, String(dto[field]));
                break;
              case "string[]":
                this.user.data.set(
                  "settings",
                  field,
                  (dto[field] as string[]).join(","),
                );
                break;
              case "boolean":
                this.user.data.set(
                  "settings",
                  field,
                  dto[field] ? "true" : "false",
                );
                break;
              case "json":
                this.user.data.set(
                  "settings",
                  field,
                  JSON.stringify(dto[field]),
                );
                break;
            }
          }
        }
      } else {
        this.user.log.trace("Ignoring field: " + field);
      }
    }
    await this.user.data.save();
    return true;
  }
}
