import AbstractMapper from "./AbstractMapper.ts";
import { UserDto, FieldMapping } from "../types/index.ts";
import Operator from "../models/Operator.ts";

export default class UserMapper extends AbstractMapper<UserDto> {
  static userMapping: FieldMapping = {
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
      set: ["none"], // todo - there should be a rename-user command instead
    },
    homedir: {
      type: "string",
      label: "Home directory",
      get: ["manageUsers"],
      set: ["none"],
      required: false,
    },
    is_public: {
      type: "boolean",
      label: "Show my profile in public",
      get: ["manageUsers"],
      set: ["manageUsers"],
      required: false,
    },
    loglevel: {
      type: "string",
      label: "Logger level",
      get: ["manageUsers"],
      set: ["manageUsers"],
      required: false,
    },
    report: {
      type: "json",
      label: "Report",
      get: ["any"],
      set: ["none"],
      required: false,
    },
  };
  mapping = UserMapper.userMapping;

  /**
   * Return a dto based on the operator and operation
   * @param operator
   * @returns key/value pairs for the dto
   */
  async getDto(operator: Operator): Promise<UserDto> {
    const fields = this.getDtoFields(operator, "get");
    const dto: UserDto = {
      model: "user",
      id: this.user.id,
    };
    for (const field in dto) {
      if (fields.includes(field)) {
        switch (field) {
          case "homedir":
            dto[field] = this.user.homedir;
            break;
          case "is_public":
            dto[field] = this.user.data.get("settings", "IS_PUBLIC") === "true";
            break;
          case "loglevel":
            dto[field] = this.user.data.get("settings", "LOGGER_LEVEL");
            break;
          case "report":
            dto[field] = await this.user.getReport();
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
  async putDto(operator: Operator, dto: UserDto): Promise<boolean> {
    const fields = this.getDtoFields(operator, "set");
    for (const field in dto) {
      if (fields.includes(field)) {
        switch (field) {
          case "is_public":
            this.user.data.set(
              "settings",
              "IS_PUBLIC",
              dto[field] ? "true" : "false",
            );
            break;
          case "loglevel":
            this.user.data.set(
              "settings",
              "LOGGER_LEVEL",
              dto[field] as string,
            );
            break;
        }
      } else {
        this.user.log.trace("Ignoring field: " + field);
      }
    }
    await this.user.data.save();
    return true;
  }
}
