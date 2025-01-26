import AbstractMapper from "./AbstractMapper";
import { Dto, FieldMapping } from "./AbstractMapper";
import Operator from "../models/Operator";

interface UserDto extends Dto {
  id?: string;
  homedir?: string;
}

export default class UserMapper extends AbstractMapper {
  mapping: FieldMapping = {
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
  };

  /**
   * Return a small report for this feed
   * @returns the report in text
   */

  getReport(): string {
    this.user.trace("User", "report");
    let report = "";
    report += "\nUser: " + this.user.id;
    report += "\n - homedir: " + this.user.homedir;
    return report;
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
          dto["id"] = this.user.id;
          break;
        case "homedir":
          dto["homedir"] = this.user.homedir;
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
      switch (field) {
        case "id":
          if (field in fields)
            throw this.user.error("Cannot set ID: unimplemented");
          break;
        default:
          throw this.user.error("Unknown field: " + field);
      }
    });
    return true;
  }
}
