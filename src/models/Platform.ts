import * as fs from "fs";

import Folder from "./Folder";
import Logger from "../services/Logger";
import { PlatformId } from "../platforms";
import Post from "./Post";
import { PostStatus } from "./Post";

/**
 * Platform base class to extend all platforms on
 *
 * When extending, implement at least
 * preparePost() and publishPost()
 */
export default class Platform {
  active: boolean = false;
  id: PlatformId = PlatformId.UNKNOWN;
  defaultBody: string = "Fairpost feed";
  assetsFolder: string = "_fairpost";
  postFileName: string = "post.json";

  /**
   * Return a small report for this feed
   * @returns the report in text
   */

  report(): string {
    Logger.trace("Platform", "report");
    let report = "";
    report += "\nPlatform: " + this.id;
    report += "\n - active: " + this.active;
    return report;
  }

  /**
   * setup
   *
   * Set the platform up. Get the required keys and tokens.
   * This may involve starting a webserver and/or communicating
   * via the CLI.
   * @returns - any object
   */
  async setup() {
    throw Logger.error(
      "No setup implemented for " +
        this.id +
        ". Read the docs in the docs folder.",
    );
  }

  /**
   * test
   *
   * Test the platform installation. This should not post
   * anything, but test access tokens et al. It can return
   * anything.
   * @returns - any object
   */
  async test(): Promise<unknown> {
    return "No tests implemented for " + this.id;
  }

  /**
   * refresh
   *
   * Refresh the platform installation. This usually refreshes
   * access tokens if required. It can throw errors
   * @returns - true if refreshed
   */
  async refresh(): Promise<boolean> {
    Logger.trace("Refresh not implemented for " + this.id);
    return false;
  }

  /**
   * getPostFilePath
   * @param folder the folder for the new or existing post
   * @returns the full path to the post file used
   * to store data for a post of this platform
   */
  getPostFilePath(folder: Folder): string {
    return folder.path + "/" + this.assetsFolder + "/" + this.postFileName;
  }

  /**
   * getPost
   * @param folder - the folder to get the post for this platform from
   * @returns {Post} the post for this platform for the given folder, if it exists.
   */

  getPost(folder: Folder): Post | undefined {
    Logger.trace("Platform", "getPost");

    const postFilePath = this.getPostFilePath(folder);
    if (fs.existsSync(postFilePath)) {
      const data = JSON.parse(fs.readFileSync(postFilePath, "utf8"));
      if (data) {
        return new Post(folder, this, data);
      }
    }
    return;
  }

  /**
   * preparePost
   *
   * Prepare the post for this platform for the
   * given folder, and save it. Optionally create
   * derivates of media and save those, too.
   *
   * If the post exists and is published, ignore.
   * If the post exists and is failed, set it back to
   * unscheduled.
   *
   * Do not throw errors. Instead, catch and log them,
   * and set the post.valid to false
   *
   * Presume the post may have already been prepared
   * before, and manually adapted later. For example,
   * post.skip may have manually been set to true.
   * @param folder - the folder for which to prepare a post for this platform
   * @returns the prepared post
   */
  async preparePost(folder: Folder): Promise<Post> {
    Logger.trace("Platform", "preparePost");

    const post = this.getPost(folder) ?? new Post(folder, this);
    if (post.status === PostStatus.PUBLISHED) {
      return post;
    }
    if (post.status === PostStatus.FAILED) {
      post.status = PostStatus.UNSCHEDULED;
    }

    // some default logic. override this
    // in your own platform if you want;
    // but more likely, call super.preparePost
    // before adding your own logic.

    // always update the files, they may have changed
    // on disk; but also maintain some properties that may have
    // been changed manually

    post.purgeFiles();
    const files = await folder.getFiles();
    files.forEach((file) => {
      if (!post.ignoreFiles?.includes(file.name)) {
        post.putFile(file);
      }
    });
    post.reorderFiles();

    const textFiles = post.getFiles("text");

    if (post.hasFile("body.txt")) {
      post.body = fs.readFileSync(post.folder.path + "/body.txt", "utf8");
    } else if (textFiles.length === 1) {
      const bodyFile = textFiles[0].name;
      post.body = fs.readFileSync(post.folder.path + "/" + bodyFile, "utf8");
    } else {
      post.body = this.defaultBody;
    }

    if (post.hasFile("title.txt")) {
      post.title = fs.readFileSync(post.folder.path + "/title.txt", "utf8");
    } else if (post.hasFile("subject.txt")) {
      post.title = fs.readFileSync(post.folder.path + "/subject.txt", "utf8");
    }

    if (post.hasFile("tags.txt")) {
      post.tags = fs
        .readFileSync(post.folder.path + "/tags.txt", "utf8")
        .split(/\s/);
    }
    if (post.hasFile("mentions.txt")) {
      post.mentions = fs
        .readFileSync(post.folder.path + "/mentions.txt", "utf8")
        .split(/\s/);
    }
    if (post.hasFile("geo.txt")) {
      post.geo = fs.readFileSync(post.folder.path + "/geo.txt", "utf8");
    }

    post.decompileBody();

    if (post.title) {
      post.valid = true;
    }

    if (post.status === PostStatus.UNKNOWN) {
      post.status = PostStatus.UNSCHEDULED;
    }

    post.save();
    return post;
  }

  /**
   * publishPost
   *
   * - publish the post for this platform, sync.
   * - when done, pass the result to post.processResult()
   *
   * do not throw errors, instead catch and log them, and
   * set the post to failed.
   * @returns {Promise} succes status
   */

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("Platform", "publishPost", post.id, dryrun);
    return post.processResult("-99", "#undefined", {
      date: new Date(),
      dryrun: dryrun,
      success: false,
      response: {},
      error: new Error("publishing not implemented for " + this.id),
    });
  }
}
