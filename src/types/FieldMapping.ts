/**
 * A FieldMapping on a model defines which fields
 * are supposed to go in the Dto and which
 * are restrictions may be imposed based on permissions
 * on getting and setting the value.
 */

export default interface FieldMapping {
  [field: string]: {
    type:
      | "string"
      | "string[]"
      | "integer"
      | "float"
      | "boolean"
      | "date"
      | "json";
    label: string;
    get: string[]; // (permissions | any | none)[]
    set: string[]; // (permissions | any | none)[]
    required?: boolean; // only if settable
    default?: string | string[] | number | boolean | Date | object;
  };
}
