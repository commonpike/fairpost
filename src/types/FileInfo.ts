import { FileGroup } from "./index.ts";
export default interface FileInfo {
  name: string;
  original?: string;
  basename: string;
  extension: string;
  group: FileGroup;
  size: number;
  mimetype: string;
  order: number;
  width?: number;
  height?: number;
}
