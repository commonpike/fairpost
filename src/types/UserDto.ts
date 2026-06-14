import { UserReport } from "./index.ts";

export default interface UserDto {
  model: string;
  id: string;
  homedir?: string;
  is_public?: boolean;
  loglevel?: string;
  report?: UserReport;
}
