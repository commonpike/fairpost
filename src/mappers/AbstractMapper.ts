import User from "../models/User";
import Operator from "../models/Operator";

export type OperationType = "create" | "read" | "update" | "delete";

export type DtoConfig = {
  [operation in OperationType | "any"]: {
    [field: string]: true | string[];
  };
};

export interface Dto {
  [key: string]: boolean | number | number[] | string | string[] | undefined;
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
 * For read operations, the mapper shall only return the fields
 * allowed to be read by the operator.
 *
 * For create and update operations, the mapper shall return
 * only the fields allowed to be set by the operator.
 *
 */

export default abstract class AbstractMapper {
  protected user: User;

  constructor(user: User) {
    this.user = user;
  }

  protected abstract dtoConfig: DtoConfig;

  abstract getReport(): string;

  abstract getDto(operator: Operator, operation: OperationType): Dto;

  protected getDtoFields(
    operator: Operator,
    operation: OperationType,
  ): string[] {
    const permissions = operator.getPermissions(this.user);
    const anyFields = Object.keys(this.dtoConfig["any"]).filter((field) => {
      if (this.dtoConfig["any"][field] === true) return true;
      if (
        (this.dtoConfig["any"][field] as string[]).some(
          (permission) =>
            permission in permissions &&
            permissions[permission as keyof typeof permissions],
        )
      ) {
        return true;
      }
      return false;
    });
    const operationFields = Object.keys(this.dtoConfig[operation]).filter(
      (field) => {
        if (anyFields.includes(field)) return false;
        if (this.dtoConfig[operation][field] === true) return true;
        if (
          (this.dtoConfig[operation][field] as string[]).some(
            (permission) =>
              permission in permissions &&
              permissions[permission as keyof typeof permissions],
          )
        ) {
          return true;
        }
        return false;
      },
    );
    return anyFields.concat(operationFields);
  }
}
