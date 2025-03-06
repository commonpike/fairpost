import { FileInfo, PostStatus, PostResult, Dto } from "./index.ts";
export default interface PostDto
  extends Dto<{
    model?: string;
    id?: string;
    user_id?: string;
    platform_id?: string;
    source_id?: string;
    valid?: boolean;
    skip?: boolean;
    status?: PostStatus;
    scheduled?: string; // date
    published?: string; // date
    title?: string;
    body?: string;
    tags?: string[];
    mentions?: string[];
    geo?: string;
    files?: FileInfo[];
    ignore_files?: string[];
    results?: PostResult[];
    remote_id?: string;
    link?: string;
  }> {}
