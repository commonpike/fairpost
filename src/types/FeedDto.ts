export default interface FeedDto {
  model: string;
  id: string;
  user_id: string;
  path?: string;
  sources?: string[];
}
