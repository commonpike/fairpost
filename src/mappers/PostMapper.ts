import AbstractMapper from "./AbstractMapper.ts";
import { PostDto, FileInfo, FieldMapping } from "../types/index.ts";
import Operator from "../models/Operator.ts";
import Post from "../models/Post.ts";

export default class PostMapper extends AbstractMapper<PostDto> {
  private post: Post;
  static postMapping: FieldMapping = {
    model: {
      type: "string",
      label: "Model",
      get: ["any"],
      set: ["none"],
    },
    id: {
      type: "string",
      label: "ID",
      get: ["managePosts"],
      set: ["none"],
    },
    user_id: {
      type: "string",
      label: "User ID",
      get: ["managePosts"],
      set: ["none"],
    },
    platform_id: {
      type: "string",
      label: "Platform ID",
      get: ["managePosts"],
      set: ["none"],
    },
    source_id: {
      type: "string",
      label: "Source ID",
      get: ["managePosts"],
      set: ["none"],
    },
    valid: {
      type: "boolean",
      label: "Valid",
      get: ["managePosts"],
      set: ["none"],
    },
    status: {
      type: "string",
      label: "Status",
      get: ["managePosts"],
      set: ["none"],
    },
    scheduled: {
      type: "date",
      label: "Scheduled date",
      get: ["managePosts"],
      set: ["managePosts"],
    },
    published: {
      type: "date",
      label: "Published date",
      get: ["managePosts"],
      set: ["none"],
    },
    title: {
      type: "string",
      label: "Title",
      get: ["managePosts"],
      set: ["managePosts"],
    },
    body: {
      type: "string",
      label: "Body",
      get: ["managePosts"],
      set: ["managePosts"],
    },
    tags: {
      type: "string[]",
      label: "Tags",
      get: ["managePosts"],
      set: ["managePosts"],
    },
    mentions: {
      type: "string[]",
      label: "Mentions",
      get: ["managePosts"],
      set: ["managePosts"],
    },
    geo: {
      type: "string",
      label: "Geo",
      get: ["managePosts"],
      set: ["managePosts"],
    },
    files: {
      type: "json",
      label: "Files",
      get: ["managePosts"],
      set: ["managePosts"],
    },
    ignore_files: {
      type: "string[]",
      label: "Ignore files",
      get: ["managePosts"],
      set: ["managePosts"],
    },
    results: {
      type: "json",
      label: "Results",
      get: ["managePosts"],
      set: ["none"],
    },
    remote_id: {
      type: "string",
      label: "Remote ID",
      get: ["readPosts"],
      set: ["none"],
    },
    link: {
      type: "string",
      label: "Link",
      get: ["readPosts"],
      set: ["none"],
    },
  };
  mapping = PostMapper.postMapping;

  constructor(post: Post) {
    super(post.platform.user);
    this.post = post;
  }

  /**
   * Return a dto based on the operator and operation
   * @param operator
   * @returns key/value pairs for the dto
   */
  async getDto(operator: Operator): Promise<PostDto> {
    const fields = this.getDtoFields(operator, "get");
    const dto: PostDto = {
      user_id: this.user.id,
      model: "post",
      id: this.post.id,
    };
    for (const field of fields) {
      switch (field) {
        case "platform_id":
          dto[field] = this.post.platform.id;
          break;
        case "source_id":
          dto[field] = this.post.source.id;
          break;
        case "valid":
          dto[field] = this.post.valid;
          break;
        case "status":
          dto[field] = this.post.status;
          break;
        case "scheduled":
          dto[field] = this.post.scheduled?.toISOString();
          break;
        case "published":
          dto[field] = this.post.published?.toISOString();
          break;
        case "title":
          dto[field] = this.post.title;
          break;
        case "body":
          dto[field] = this.post.body;
          break;
        case "tags":
          dto[field] = this.post.tags;
          break;
        case "mentions":
          dto[field] = this.post.mentions;
          break;
        case "geo":
          dto[field] = this.post.geo;
          break;
        case "files":
          dto[field] = this.post.files;
          break;
        case "ignore_files":
          dto[field] = this.post.ignoreFiles;
          break;
        case "results":
          dto[field] = this.post.results;
          break;
        case "remote_id":
          dto[field] = this.post.remoteId;
          break;
        case "link":
          dto[field] = this.post.link;
          break;
      }
    }
    //console.log(this.post,dto);
    return dto;
  }

  /**
   * Insert a given dto based on the operator
   * @param operator
   * @param dto
   * @returns boolean success
   */
  async putDto(operator: Operator, dto: PostDto): Promise<boolean> {
    const fields = this.getDtoFields(operator, "set");
    for (const field in dto) {
      if (fields.includes(field)) {
        switch (field) {
          case "scheduled":
            this.post.scheduled = new Date((dto.scheduled as string) ?? "");
            break;
          case "title":
            this.post.title = (dto[field] as string) ?? "";
            break;
          case "body":
            this.post.body = (dto[field] as string) ?? "";
            break;
          case "tags":
            this.post.tags = (dto[field] as string[]) ?? [];
            break;
          case "mentions":
            this.post.mentions = (dto[field] as string[]) ?? [];
            break;
          case "geo":
            this.post.geo = (dto[field] as string) ?? "";
            break;
          case "files":
            this.post.files = (dto[field] as FileInfo[]) ?? [];
            break;
          case "ignore_files":
            this.post.ignoreFiles = (dto[field] as string[]) ?? [];
            break;
        }
      } else {
        this.user.log.trace("Ignoring field: " + field);
      }
    }
    return true;
  }
}
