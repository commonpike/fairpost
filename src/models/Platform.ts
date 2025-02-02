import * as fs from "fs";
import * as pluginClasses from "../plugins";
import { PlatformId } from "../platforms";
import PlatformMapper from "../mappers/PlatformMapper";
import { FieldMapping } from "../mappers/AbstractMapper";

import Source, { FileGroup } from "./Source";

import Plugin from "./Plugin";
import Post from "./Post";
import { PostStatus } from "./Post";
import User from "./User";

/**
 * Platform base class to extend all platforms on
 *
 * When extending, implement at least
 * preparePost() and publishPost()
 */
export default class Platform {
  id: PlatformId = PlatformId.UNKNOWN;
  active: boolean = false;
  user: User;
  defaultBody: string = "Fairpost feed";
  assetsFolder: string = "_fairpost";
  postFileName: string = "post.json";
  mapper: PlatformMapper;
  settings: FieldMapping = {};

  constructor(user: User) {
    this.user = user;
    this.id = (this.constructor as typeof Platform).id();
    this.mapper = new PlatformMapper(this);
  }

  /**
   * Return the id of this platform as used in settings.
   * By default, this is the lowercase name of the class,
   * but you can override this in your own platform.
   * @returns the id
   */
  static id(): PlatformId {
    return this.name.toLowerCase() as PlatformId;
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
    throw this.user.error(
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
    this.user.trace("Refresh not implemented for " + this.id);
    return false;
  }

  /**
   * getPostFilePath
   * @param source the source for the new or existing post
   * @returns the full path to the post file used
   * to store data for a post of this platform
   */
  getPostFilePath(source: Source): string {
    return source.path + "/" + this.assetsFolder + "/" + this.postFileName;
  }

  /**
   * getPost
   * @param source - the source to get the post for this platform from
   * @returns {Post} the post for this platform for the given source, if it exists.
   */

  getPost(source: Source): Post | undefined {
    this.user.trace(this.id, "getPost", this.id, source.id);

    const postFilePath = this.getPostFilePath(source);
    if (fs.existsSync(postFilePath)) {
      const data = JSON.parse(fs.readFileSync(postFilePath, "utf8"));
      if (data) {
        return new Post(source, this, data);
      }
    }
    return;
  }

  /**
   * preparePost
   *
   * Prepare the post for this platform for the
   * given source, and save it. Optionally create
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
   * @param source - the source for which to prepare a post for this platform
   * @returns the prepared post
   */
  async preparePost(source: Source): Promise<Post> {
    this.user.trace(this.id, "preparePost");

    const post = this.getPost(source) ?? new Post(source, this);
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
    const files = await source.getFiles();
    files.forEach((file) => {
      if (!post.ignoreFiles?.includes(file.name)) {
        post.putFile(file);
      }
    });
    post.reorderFiles();

    // read textfiles and stick their contents
    // into appropriate properties - body, title, etc

    const textFiles = post.getFiles(FileGroup.TEXT);

    if (post.hasFile("body.txt")) {
      post.body = fs.readFileSync(post.source.path + "/body.txt", "utf8");
    } else if (textFiles.length === 1) {
      const bodyFile = textFiles[0].name;
      post.body = fs.readFileSync(post.source.path + "/" + bodyFile, "utf8");
    } else {
      post.body = this.defaultBody;
    }

    if (post.hasFile("title.txt")) {
      post.title = fs.readFileSync(post.source.path + "/title.txt", "utf8");
    } else if (post.hasFile("subject.txt")) {
      post.title = fs.readFileSync(post.source.path + "/subject.txt", "utf8");
    }

    if (post.hasFile("tags.txt")) {
      post.tags = fs
        .readFileSync(post.source.path + "/tags.txt", "utf8")
        .split(/\s/);
    }
    if (post.hasFile("mentions.txt")) {
      post.mentions = fs
        .readFileSync(post.source.path + "/mentions.txt", "utf8")
        .split(/\s/);
    }
    if (post.hasFile("geo.txt")) {
      post.geo = fs.readFileSync(post.source.path + "/geo.txt", "utf8");
    }

    // decompile the body to see if there are
    // appropriate metadata in there - title, tags, ..

    post.decompileBody();

    // validate and set status

    if (post.title) {
      post.valid = true;
    }

    if (post.status === PostStatus.UNKNOWN) {
      post.status = PostStatus.UNSCHEDULED;
    }

    // save
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
    this.user.trace(this.id, "publishPost", post.id, dryrun);
    return post.processResult("-99", "#undefined", {
      date: new Date(),
      dryrun: dryrun,
      success: false,
      response: {},
      error: new Error("publishing not implemented for " + this.id),
    });
  }

  /**
   * @returns array of instances of the plugins given with the settings given.
   */
  loadPlugins(pluginSettings: { [pluginid: string]: object }): Plugin[] {
    const plugins: Plugin[] = [];
    Object.values(pluginClasses).forEach((pluginClass) => {
      const pluginId = pluginClass.name.toLowerCase();
      if (pluginId in pluginSettings) {
        plugins?.push(new pluginClass(pluginSettings[pluginId]));
      }
    });
    return plugins;
  }
}
