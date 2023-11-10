import Logger from "../core/Logger";
import Platform from "../core/Platform";
import { PlatformId } from ".";
import Folder from "../core/Folder";
import Post from "../core/Post";
import LinkedInAuth from "../auth/LinkedInAuth";
import { PostStatus } from "../core/Post";
import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

export default class LinkedIn extends Platform {
  id: PlatformId = PlatformId.LINKEDIN;
  GRAPH_API_VERSION: string = "v18.0";

  auth: LinkedInAuth;

  constructor() {
    super();
    this.auth = new LinkedInAuth();
  }

  /** @inheritdoc */
  async setup() {
    return await this.auth.setup();
  }

  /** @inheritdoc */
  async test() {
    super.test();
  }

  async preparePost(folder: Folder): Promise<Post> {
    const post = await super.preparePost(folder);
    // ...
    post.save();

    return post;
  }

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("LinkedIn.publishPost", post, dryrun);

    return super.publishPost(post, dryrun);
  }


  

  /*
   * Handle api response
   *
   */
  private async handleApiResponse(response: Response): Promise<object> {
    if (!response.ok) {
      Logger.error("Linkedin.handleApiResponse", response);
      throw new Error(response.status + ":" + response.statusText);
    }
    const data = await response.json();
    if (data.error) {
      const error =
        response.status +
        ":" +
        data.error.type +
        "(" +
        data.error.code +
        "/" +
        data.error.error_subcode +
        ") " +
        data.error.message;
      Logger.error("Linkedin.handleApiResponse", error);
      throw new Error(error);
    }
    Logger.trace("Linkedin.handleApiResponse", "success");
    return data;
  }

  /*
   * Handle api error
   *
   */
  private handleApiError(error: Error): Promise<object> {
    Logger.error("Linkedin.handleApiError", error);
    throw error;
  }
}
