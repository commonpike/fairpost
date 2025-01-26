import AbstractMapper from "./AbstractMapper";
import { Dto, DtoConfig, OperationType } from "./AbstractMapper";
import Operator from "../models/Operator";

interface UserDto extends Dto {
  id?: string;
  homedir?: string;
}

export default class UserMapper extends AbstractMapper {
  protected dtoConfig: DtoConfig = {
    any: {
      id: true,
    },
    create: {
      homedir: ["manageUsers"],
    },
    read: {
      homedir: ["manageUsers"],
    },
    update: {
      id: ["manageUsers"],
    },
    delete: {},
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
   * @param operation
   * @returns key/value pairs for the dto
   */
  getDto(operator: Operator, operation: OperationType): UserDto {
    const fields = this.getDtoFields(operator, operation);
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
}
