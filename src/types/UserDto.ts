export default interface UserDto {
  model: string;
  id: string;
  homedir?: string;
  loglevel?: string;
  report?: object; // TODO be more specific
}
