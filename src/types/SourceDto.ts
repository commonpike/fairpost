import { type FileInfo } from "./index.ts";
export default interface SourceDto {
  model: string;
  id: string;
  user_id: string;
  feed_id?: string;
  path?: string;
  files?: FileInfo[];
}
