export default interface PlatformDto {
  model: string;
  id: string;
  user_id: string;
  active?: boolean;
  // more fields added by platform
  [key: string]: string | string[] | number | boolean | undefined;
}
