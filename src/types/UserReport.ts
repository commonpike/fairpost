import SourceStatus from "./SourceStatus";
import PostStatus from "./PostStatus";
import { PlatformId } from "../platforms";
export default interface UserReport {
  feed: {
    count: {
      [status in SourceStatus]?: number;
    };
    lastId: string;
    nextId: string;
  };
  platforms: {
    [id in PlatformId]?: {
      link: string;
      count: {
        [status in PostStatus]?: number;
      };
      lastId: string;
      nextId: string;
      lastLink: string;
    };
  };
}
