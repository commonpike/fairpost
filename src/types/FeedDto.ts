export default interface FeedDto {
  model: string;
  id: string;
  user_id: string;
  path?: string;
  interval?: number;
  platforms?: string[];
  connected?: string[];
  sources?: string[];
}
