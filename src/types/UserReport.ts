import SourceStage from "./SourceStage";
import PostStatus from "./PostStatus";
import { PlatformId } from "../platforms";
export default interface UserReport {
  feed: {
    count: {
      [status in SourceStage]?: number;
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
