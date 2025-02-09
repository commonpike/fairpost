import AbstractMapper from "./AbstractMapper";
import { Dto, FieldMapping } from "./AbstractMapper";
import Operator from "../models/Operator";

export interface UserDto
  extends Dto<{
    model?: string;
    id?: string;
    homedir?: string;
    loglevel?: string;
  }> {}

export default class UserMapper extends AbstractMapper<UserDto> {
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
      set: ["manageUsers"],
      required: true,
    },
    homedir: {
      type: "string",
      label: "Home directory",
      get: ["manageUsers"],
      set: ["none"],
      required: false,
    },
    loglevel: {
      type: "string",
      label: "Logger level",
      get: ["manageUsers"],
      set: ["manageUsers"],
      required: false,
    },
  };

  /**
   * Return a dto based on the operator and operation
   * @param operator
   * @returns key/value pairs for the dto
   */
  async getDto(operator: Operator): Promise<UserDto> {
    const fields = this.getDtoFields(operator, "get");
    const dto: UserDto = {};
    fields.forEach((field) => {
      switch (field) {
        case "model":
          dto[field] = "user";
          break;
        case "id":
          dto[field] = this.user.id;
          break;
        case "homedir":
          dto[field] = this.user.homedir;
          break;
        case "loglevel":
          dto[field] = this.user.get("settings", "LOGGER_LEVEL");
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
  async setDto(operator: Operator, dto: Dto): Promise<boolean> {
    const fields = this.getDtoFields(operator, "set");
    for (const field in dto) {
      if (field in fields) {
        switch (field) {
          case "id":
            // todo - there should be a rename-user command instead
            throw this.user.error("Cannot set ID: unimplemented");
            break;
          case "loglevel":
            this.user.set("settings", "LOGGER_LEVEL", dto[field] as string);
            break;
        }
      } else {
        throw this.user.error("Unknown field: " + field);
      }
    }
    return true;
  }
}
