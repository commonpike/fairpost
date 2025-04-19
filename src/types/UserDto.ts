import { UserReport } from "./index.ts";

export default interface UserDto {
  model: string;
  id: string;
  homedir?: string;
  loglevel?: string;
  report?: UserReport;
}
