export default interface PostResult {
  date: Date;
  dryrun?: boolean;
  error?: Error;
  success: boolean;
  response: object;
}
