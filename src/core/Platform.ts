import * as fs from "fs";
import Logger from "./Logger";
import Folder from "./Folder";
import Post from "./Post";
import { PostStatus } from "./Post";
import { PlatformId } from "../platforms";

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
   * getPostFileName
   * @returns the intended name for a post of this
   * platform to be saved in this folder.
   */
  getPostFileName(): string {
    return "_" + this.id + ".json";
  }

  /**
   * getPost
   * @param folder - the folder to get the post for this platform from
   * @returns {Post} the post for this platform for the given folder, if it exists.
   */

  getPost(folder: Folder): Post | undefined {
    Logger.trace("Platform", "getPost");

    if (fs.existsSync(folder.path + "/" + this.getPostFileName())) {
      const data = JSON.parse(
        fs.readFileSync(folder.path + "/" + this.getPostFileName(), "utf8"),
      );
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
    // in your own platform if you need.

    post.files = folder.getFiles();

    if (post.files.text?.includes("body.txt")) {
      post.body = fs.readFileSync(post.folder.path + "/body.txt", "utf8");
    } else if (post.files.text.length === 1) {
      const bodyFile = post.files.text[0];
      post.body = fs.readFileSync(post.folder.path + "/" + bodyFile, "utf8");
    } else {
      post.body = this.defaultBody;
    }

    if (post.files.text?.includes("title.txt")) {
      post.title = fs.readFileSync(post.folder.path + "/title.txt", "utf8");
    } else {
      post.title = post.body.split("\n", 1)[0];
    }

    if (post.files.text?.includes("tags.txt")) {
      post.tags = fs.readFileSync(post.folder.path + "/tags.txt", "utf8");
    }

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
   * publish the post for this platform, sync.
   * set the posted date to now.
   * add the result to post.results
   * on success, set the status to published and return true,
   * else set the status to failed and return false
   * @returns {Promise} succes status
   */

  async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {
    Logger.trace("Platform", "publishPost", post.id, dryrun);
    post.results.push({
      date: new Date(),
      success: false,
      error: new Error("publishing not implemented for " + this.id),
      response: {},
    });
    post.published = undefined;
    post.status = PostStatus.FAILED;
    post.save();
    return false;
  }

  /**
   * setup
   *
   * Set the platform up. Get the required keys and tokens.
   * This may involve starting a webserver and/or communicating
   * via the CLI.
   * @returns - any object
   */
  async setup(): Promise<unknown> {
    return (
      "No setup implemented for " +
      this.id +
      ". Read the docs in the docs folder."
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
}