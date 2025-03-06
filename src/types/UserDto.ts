import { Dto } from "./index.ts";
export default interface UserDto
  extends Dto<{
    model?: string;
    id?: string;
    homedir?: string;
    loglevel?: string;
  }> {}
