import SourceStatus from "./SourceStatus";
import PostStatus from "./PostStatus";
import { PlatformId } from "../platforms";
export default interface UserReport {
  feed: {
    sources: {
      [status in SourceStatus]?: number;
    };
    lastId: string;
    nextId: string;
  };
  platforms: {
    [id in PlatformId]?: {
      link: string;
      posts: {
        [status in PostStatus]?: number;
      };
      lastId: string;
      lastLink: string;
      nextId: string;
    };
  };
}
