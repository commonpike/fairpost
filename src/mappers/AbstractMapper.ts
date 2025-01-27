import User from "../models/User";
import Operator from "../models/Operator";

export interface FieldMapping {
  [field: string]: {
    type: "string" | "string[]" | "integer" | "float" | "boolean" | "json";
    label: string;
    get: string[]; // (permissions | any | none)[]
    set: string[]; // (permissions | any | none)[]
    required: boolean;
  };
}

export interface Dto {
  [key: string]: string | string[] | number | boolean | undefined;
}

/**
 * AbstractMapper - base for all mappers
 *
 * The mappers are used to create mapped versions of the models;
 * for example, to send to or read from a client or a database.
 *
 * All mappers require a *user* because the user can optionally
 * configure what data is visible, fe to the operator.
 *
 * For get operations, the mapper shall only return the fields
 * allowed to be get by the operator.
 *
 * For set operations, the mapper shall return
 * only the fields allowed to be set by the operator.
 *
 */

export default abstract class AbstractMapper {
  protected user: User;

  constructor(user: User) {
    this.user = user;
  }

  protected abstract mapping: FieldMapping;

  public getReport(operator: Operator): string {
    const dto = this.getDto(operator);
    const lines: string[] = [];
    for (const field in dto) {
      let line = "";
      if (field in this.mapping) {
        line += this.mapping[field].label + ": ";
      } else {
        line += field + ": ";
      }
      if (dto[field] instanceof Array) {
        lines.push(line);
        (dto[field] as string[]).forEach((item) => {
          lines.push(" - " + String(item));
        });
      } else {
        line += String(dto[field]);
        lines.push(line);
      }
    }
    return lines.join("\n");
  }

  /**
   * Return a dto based on the operator
   * @param operator
   * @returns key/value pairs for the dto
   */
  abstract getDto(operator: Operator): Dto;

  /**
   * Insert a given dto based on the operator
   * @param operator
   * @param dto
   * @returns boolean success
   */
  abstract setDto(operator: Operator, dto: Dto): boolean;

  protected getDtoFields(
    operator: Operator,
    operation: "get" | "set",
  ): string[] {
    const permissions = operator.getPermissions(this.user);
    const fields = Object.keys(this.mapping).filter((field) => {
      if (this.mapping[field][operation].includes("none")) return false;
      if (this.mapping[field][operation].includes("any")) return true;
      if (
        this.mapping[field][operation].some(
          (permission) =>
            permission in permissions &&
            permissions[permission as keyof typeof permissions],
        )
      ) {
        return true;
      }
      return false;
    });
    return fields;
  }
}
