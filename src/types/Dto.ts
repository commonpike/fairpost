import { FileInfo, PostStatus, PostResult } from "./index.ts";
type Dto<T extends Record<string, unknown> = Record<string, unknown>> = {
  [K in keyof T]:
    | string
    | string[]
    | number
    | boolean
    | FileInfo[]
    | PostResult[]
    | PostStatus
    | undefined;
};
export { Dto as default };
