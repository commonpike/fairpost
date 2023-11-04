import Storage from "../core/Storage";
import Logger from "../core/Logger";
import RedditAuth from "../auth/RedditAuth";
import { PlatformId } from ".";
import Platform from "../core/Platform";
import Folder from "../core/Folder";
import Post, { PostStatus } from "../core/Post";
import * as fs from "fs";
import * as sharp from "sharp"; 

/**
 * Reddit: support for reddit platform
 */
export default class Reddit extends Platform {
  id = PlatformId.REDDIT;

  constructor() {
    super();
  }

  /** @inheritdoc */
  async setup() {
    const auth = new RedditAuth();
    return await auth.setup();
  }

  /** @inheritdoc */
  async test() {
    return false;
  }

  
}
