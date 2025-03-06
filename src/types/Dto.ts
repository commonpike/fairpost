import type FeedDto from "./FeedDto.ts";
import type PlatformDto from "./FeedDto.ts";
import type PostDto from "./FeedDto.ts";
import type SourceDto from "./FeedDto.ts";
import type UserDto from "./FeedDto.ts";

type Dto = FeedDto | PlatformDto | PostDto | SourceDto | UserDto;
export { type Dto as default };
