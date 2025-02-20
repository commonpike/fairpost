import { PlatformId } from "../platforms/index.ts";
import { PostStatus } from "../models/Post.ts";

/**
 * CommandArguments are the arguments that can be passed
 * to the Fairpost.execute method.
 */
export interface CommandArguments {
  dryrun?: boolean;
  user?: string;
  platforms?: PlatformId[];
  platform?: PlatformId;
  sources?: string[];
  source?: string;
  date?: Date;
  status?: PostStatus;
}

/**
 * A CombinedResult can be returned if you need to pass
 * on failure without interupting a process, f.e. when
 * you are operating on multiple subjects and some can
 * fail, but you want to handle all.
 * But in general, if you only plan to return one result,
 * do that or throw an error and let the callee catch it.
 */

export interface CombinedResult {
  success: boolean;
  message?: string;
  result?: unknown;
}
