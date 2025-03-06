import { Dto } from "./index.ts";
export default interface FeedDto
  extends Dto<{
    model?: string;
    id?: string;
    user_id?: string;
    path?: string;
    sources?: string[];
  }> {}
