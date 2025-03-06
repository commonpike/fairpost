import { FileInfo, Dto } from "./index.ts";
export default interface SourceDto
  extends Dto<{
    model?: string;
    id?: string;
    user_id?: string;
    feed_id?: string;
    path?: string;
    files?: FileInfo;
  }> {}
