import { Dto } from "./index.ts";
export default interface PlatformDto
  extends Dto<{
    model?: string;
    id?: string;
    user_id?: string;
    active?: boolean;
    // more fields added by platform
    [key: string]: string | string[] | number | boolean | undefined;
  }> {}
