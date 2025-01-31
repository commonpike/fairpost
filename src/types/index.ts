/**
 * A GenericResult can be returned if you need to pass
 * on failure without interupting a process, f.e. when
 * you are operating on multiple subjects and some can
 * fail, but you want to handle all.
 *
 * Also, if the type of the result is `unknown`,
 * In general, if you only plan to return one result,
 * do that or throw an error and let the callee catch it.
 */
export interface GenericResult {
  success: boolean;
  message?: string;
  result?: unknown;
}

export interface CombinedResults {
  success: boolean;
  message?: string;
  result?: unknown;
}
[];
