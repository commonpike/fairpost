import { PlatformId } from "../platforms/index.ts";
import { PostStatus } from "./index.ts";

/**
 * CommandArguments are the arguments that can be passed
 * to the Fairpost.execute method.
 */
export default interface CommandArguments {
  dryrun?: boolean;
  user?: string;
  platforms?: PlatformId[];
  platform?: PlatformId;
  sources?: string[];
  source?: string;
  date?: Date;
  status?: PostStatus;
}
