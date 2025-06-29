import { type FileInfo, type SourceStage } from "./index.ts";
export default interface SourceDto {
  model: string;
  id: string;
  user_id: string;
  feed_id?: string;
  stage?: SourceStage;
  path?: string;
  files?: FileInfo[];
}
