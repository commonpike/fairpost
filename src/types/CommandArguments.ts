import { PlatformId } from "../platforms/index.ts";
import { PostStatus, SourceStage } from "./index.ts";

/**
 * CommandArguments are the arguments that can be passed
 * to the Fairpost.execute method.
 */
export default interface CommandArguments {
  dryrun?: boolean;
  user?: string;
  password?: string;
  platforms?: PlatformId[];
  platform?: PlatformId;
  sources?: string[];
  source?: string;
  date?: Date;
  status?: PostStatus;
  stage?: SourceStage;
  payload?: Buffer | string | object;
}
