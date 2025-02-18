export { default as Facebook } from "./Facebook/Facebook.ts";
export { default as Instagram } from "./Instagram/Instagram.ts";
export { default as Twitter } from "./Twitter/Twitter.ts";
export { default as Reddit } from "./Reddit/Reddit.ts";
export { default as LinkedIn } from "./LinkedIn/LinkedIn.ts";
export { default as YouTube } from "./YouTube/YouTube.ts";

export enum PlatformId {
  UNKNOWN = "unknown",
  FACEBOOK = "facebook",
  INSTAGRAM = "instagram",
  TWITTER = "twitter",
  REDDIT = "reddit",
  LINKEDIN = "linkedin",
  YOUTUBE = "youtube",
}
