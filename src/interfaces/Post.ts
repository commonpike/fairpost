
export default interface Post {
  path: string;
  platform: PlatformSlug;
  valid: boolean;
  status: PostStatus;
  scheduled?: Date;
  posted?: Date;
  results?: [{}];
  title: string;
  body?: string;
  tags?: string;
  files?: {
    text?: string[],
    image?: string[],
    video?: string[],
    other?: string[]
  };
}

export enum PlatformSlug {
  UNKNOWN = "unknown",
  ASYOUTUBE = "asyoutube",
  ASINSTAGRAM = "asinstagram",
  ASFACEBOOK = "asfacebook",
  ASTWITTER = "astwitter",
  ASTIKTOK = "astiktok",
  ASLINKEDIN = "aslinkedin",
  ASREDDIT = "asreddit"
}

export enum PostStatus {
    UNKNOWN = "unknown",
    UNSCHEDULED = "unscheduled",
    SCHEDULED = "scheduled",
    PUBLISHED = "published",
    FAILED = "failed"
}


export const blankPost: Post = {
  path: '',
  platform: PlatformSlug.UNKNOWN,
  valid: false,
  status: PostStatus.UNKNOWN,
  title: 'unknown'
}