/**
 * CommandHandler - minimalist singleton service
 *
 * Executes commands on behalf of a user
 *
 */

import { PlatformId } from "../platforms";
import { PostStatus } from "../models/Post";
import Server from "../services/Server";
import Source from "../models/Source";
import User from "../models/User";

class CommandHandler {
  static instance: CommandHandler;
  constructor() {
    if (CommandHandler.instance) {
      throw new Error("CommandHandler: call getInstance() instead");
    }
  }
  static getInstance(): CommandHandler {
    if (!CommandHandler.instance) {
      CommandHandler.instance = new CommandHandler();
    }
    return CommandHandler.instance;
  }
  async execute(
    user: User,
    command: string = "help",
    args: CommandArguments = {},
  ): Promise<{
    result: unknown;
    report: string;
  }> {
    let result: unknown;
    let report = "";

    if (user.id === "admin" && user.get("settings", "UI") !== "cli") {
      throw user.error(
        "CommandHandler " + command,
        "Attempt to access admin from wrong UI",
      );
    }

    const feed = user.id !== "admin" ? user.getFeed() : null;
    user.trace(
      "Fairpost " + user.id + " " + command,
      args.dryrun ? " dry-run" : "",
    );

    switch (command) {
      case "create-user": {
        if (user.id !== "admin") {
          throw user.error("only admins can create-user");
        }
        if (!args.userid) {
          throw user.error("userid is required");
        }
        if (!args.userid.match("^[a-z][a-z0-9_\\-\\.]{3,31}$")) {
          throw user.error(
            "invalid userid: must be between 4 and 32 long, start with a character and contain only (a-z,0-9,-,_,.)",
          );
        }
        const newUser = user.createUser(args.userid);
        result = newUser;
        report = newUser.report();
        break;
      }
      case "get-user": {
        if (args.userid) {
          if (user.id !== "admin") {
            throw user.error("only admins can get-user other users");
          }
          const other = new User(args.userid);
          result = other;
          report = other.report();
        } else {
          result = user;
          report = user.report();
        }
        break;
      }
      case "get-feed": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        result = feed;
        report = feed.report();
        break;
      }
      case "setup-platform": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.platform) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platform",
          );
        }
        await feed.setupPlatform(args.platform);
        result = "Success"; // or error
        report = "Result: \n" + JSON.stringify(result, null, "\t");

        break;
      }
      case "setup-platforms": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        await feed.setupPlatforms(args.platforms);
        result = "Success"; // or error
        report = "Result: \n" + JSON.stringify(result, null, "\t");
        break;
      }
      case "get-platform": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.platform) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platform",
          );
        }
        const platform = feed.getPlatform(args.platform);
        report += platform.report() + "\n";
        result = platform;
        break;
      }
      case "get-platforms": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        const platforms = feed.getPlatforms(args.platforms);
        report += platforms.length + " Platforms\n------\n";
        platforms.forEach((platform) => {
          report += platform.report() + "\n";
        });
        result = platforms;
        break;
      }
      case "test-platform": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.platform) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platform",
          );
        }
        result = await feed.testPlatform(args.platform);
        report = "Result: \n" + JSON.stringify(result, null, "\t");
        break;
      }
      case "test-platforms": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        result = await feed.testPlatforms(args.platforms);
        report = "Result: \n" + JSON.stringify(result, null, "\t");
        break;
      }
      case "refresh-platform": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.platform) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platform",
          );
        }
        result = await feed.refreshPlatform(args.platform);
        report = "Result: \n" + JSON.stringify(result, null, "\t");
        break;
      }
      case "refresh-platforms": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        result = await feed.refreshPlatforms(args.platforms);
        report = "Result: \n" + JSON.stringify(result, null, "\t");
        break;
      }
      case "get-source": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.source) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: source",
          );
        }
        const source = feed.getSource(args.source);
        if (source) {
          report += source.report() + "\n";
          result = source;
        } else {
          report += "not found:" + args.source + "\n";
        }
        break;
      }
      case "get-sources": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        const sources = feed.getSources(args.sources);
        report += sources.length + " Sources\n------\n";
        sources.forEach((source) => {
          report += source.report() + "\n";
        });
        result = sources;
        break;
      }
      case "get-sources-by-status": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        const sources = feed.getSources(args.sources);
        const groups = {} as { [status: string]: Source[] };
        sources.forEach((source) => {
          const status = feed.getSourceStatus(source.path);
          if (groups[status] === undefined) {
            groups[status] = [source];
          } else {
            groups[status].push(source);
          }
          report += source.report() + "\n";
        });
        Object.keys(groups).forEach((status) => {
          report += " " + status + "\n------\n";
          const sources = groups[status];
          report += sources.length + " Sources\n------\n";
          sources.forEach((source) => {
            report += source.report() + "\n";
          });
        });
        result = groups;
        break;
      }
      case "get-post": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.source) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: source",
          );
        }
        if (!args.platform) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platform",
          );
        }
        const post = feed.getPost(args.source, args.platform);
        if (post) {
          report += post.report();
          result = post;
        } else {
          report += "Not found:" + args.source + ":" + args.platform;
        }
        break;
      }
      case "get-posts": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        const allposts = feed.getPosts({
          sources: args.sources,
          platforms: args.platforms,
          status: args.status,
        });
        report += allposts.length + " Posts\n------\n";
        allposts.forEach((post) => {
          report += post.report();
        });
        result = allposts;
        break;
      }
      case "prepare-post": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.source) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: source",
          );
        }
        if (!args.platform) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platform",
          );
        }
        const preppost = await feed.preparePost(args.source, args.platform);
        if (preppost) {
          report += preppost.report();
          result = preppost;
        } else {
          report += "Failed: " + args.source + ":" + args.platform;
        }
        break;
      }
      case "prepare-posts": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.platforms && args.platform) {
          args.platforms = [args.platform];
        }
        if (!args.sources && args.source) {
          args.sources = [args.source];
        }
        const prepposts = await feed.preparePosts({
          sources: args.sources,
          platforms: args.platforms,
        });
        prepposts.forEach((post) => {
          report += post.report();
        });
        result = prepposts;
        break;
      }
      case "schedule-post": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.source) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: source",
          );
        }
        if (!args.platform) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platform",
          );
        }
        if (!args.date) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: date",
          );
        }
        const schedpost = feed.schedulePost(
          args.source,
          args.platform,
          args.date,
        );
        report += schedpost.report();
        result = schedpost;
        break;
      }
      case "schedule-posts": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.platforms && args.platform) {
          args.platforms = [args.platform];
        }
        if (!args.sources && args.source) {
          args.sources = [args.source];
        }
        if (!args.sources) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: sources",
          );
        }
        if (!args.date) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: date",
          );
        }
        const schedposts = feed.schedulePosts(
          {
            sources: args.sources,
            platforms: args.platforms,
          },
          new Date(args.date),
        );
        schedposts.forEach((post) => {
          report += post.report();
        });
        result = schedposts;
        break;
      }
      case "schedule-next-post": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.platforms && args.platform) {
          args.platforms = [args.platform];
        }
        if (!args.platforms) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platforms",
          );
        }
        const nextposts = feed.scheduleNextPosts(
          args.date ? new Date(args.date) : undefined,
          {
            platforms: args.platforms,
          },
        );
        nextposts.forEach((post) => {
          report += post.report();
        });
        result = nextposts;
        break;
      }
      case "publish-post": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.source) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: source",
          );
        }
        if (!args.platform) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platform",
          );
        }
        const pubpost = await feed.publishPost(
          args.source,
          args.platform,
          args.dryrun,
        );
        report += pubpost.report();
        result = pubpost;
        break;
      }
      case "publish-posts": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        if (!args.platforms && args.platform) {
          args.platforms = [args.platform];
        }
        if (!args.sources && args.source) {
          args.sources = [args.source];
        }
        if (!args.sources) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: sources",
          );
        }
        const pubposts = await feed.publishPosts(
          {
            sources: args.sources,
            platforms: args.platforms,
          },
          args.dryrun,
        );
        pubposts.forEach((post) => {
          report += post.report();
        });
        result = pubposts;
        break;
      }

      /* feed planning */
      case "schedule-next-posts": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        const nextposts = feed.scheduleNextPosts(
          args.date ? new Date(args.date) : undefined,
          {
            sources: args.sources,
            platforms: args.platforms,
          },
        );
        nextposts.forEach((post) => {
          report += post.report();
        });
        result = nextposts;
        break;
      }
      case "publish-due-posts": {
        if (!feed) throw user.error("User " + user.id + " has no feed");
        const dueposts = await feed.publishDuePosts(
          {
            sources: args.sources,
            platforms: args.platforms,
          },
          args.dryrun,
        );
        dueposts.forEach((post) => {
          report += post.report();
        });
        result = dueposts;
        break;
      }

      case "serve": {
        if (user.get("settings", "UI") !== "cli") {
          throw user.error(
            "CommandHandler " + command,
            "Attempt to launch server from wrong UI",
          );
        }
        if (user.id !== "admin") {
          throw user.error(
            "CommandHandler " + command,
            "Attempt to launch server from wrong account",
          );
        }
        await Server.serve().then((res) => {
          result = res;
          report = res;
        });
        break;
      }

      default: {
        const cmd = "fairpost:";
        result = [
          "# basic commands:",
          `${cmd} help`,
          `${cmd} @userid get-user`,
          `${cmd} @userid get-feed`,
          `${cmd} @userid setup-platform --platform=xxx`,
          `${cmd} @userid setup-platforms [--platforms=xxx,xxx]`,
          `${cmd} @userid test-platform --platform=xxx`,
          `${cmd} @userid test-platforms [--platforms=xxx,xxx]`,
          `${cmd} @userid refresh-platform --platform=xxx`,
          `${cmd} @userid refresh-platforms [--platforms=xxx,xxx]`,
          `${cmd} @userid get-platform --platform=xxx`,
          `${cmd} @userid get-platforms [--platforms=xxx,xxx]`,
          `${cmd} @userid get-source --source=xxx`,
          `${cmd} @userid get-sources [--sources=xxx,xxx]`,
          `${cmd} @userid get-post --post=xxx:xxx`,
          `${cmd} @userid get-posts [--status=xxx] [--sources=xxx,xxx] [--platforms=xxx,xxx] `,
          `${cmd} @userid prepare-post --post=xxx:xxx`,
          `${cmd} @userid schedule-post --post=xxx:xxx --date=xxxx-xx-xx `,
          `${cmd} @userid schedule-posts [--sources=xxx,xxx|--source=xxx] [--platforms=xxx,xxx|--platform=xxx] --date=xxxx-xx-xx`,
          `${cmd} @userid schedule-next-post [--date=xxxx-xx-xx] [--platforms=xxx,xxx|--platform=xxx] `,
          `${cmd} @userid publish-post --post=xxx:xxx [--dry-run]`,
          `${cmd} @userid publish-posts [--sources=xxx,xxx|--source=xxx] [--platforms=xxx,xxx|--platform=xxx]`,
          "\n# feed planning:",
          `${cmd} @userid prepare-posts  [--sources=xxx,xxx|--source=xxx] [--platforms=xxx,xxx|--platform=xxx]`,
          `${cmd} @userid schedule-next-posts [--date=xxxx-xx-xx] [--sources=xxx,xxx] [--platforms=xxx,xxx] `,
          `${cmd} @userid publish-due-posts [--sources=xxx,xxx] [--platforms=xxx,xxx] [--dry-run]`,
          "\n# admin only:",
          `${cmd} create-user --userid=xxx`,
          `${cmd} get-user --userid=xxx`,
          `${cmd} serve`,
        ];
        (result as string[]).forEach((line) => (report += "\n" + line));
      }
    }
    return {
      result: result,
      report: report,
    };
  }
}
interface CommandArguments {
  dryrun?: boolean;
  userid?: string;
  platforms?: PlatformId[];
  platform?: PlatformId;
  sources?: string[];
  source?: string;
  date?: Date;
  status?: PostStatus;
}
export default CommandHandler.getInstance();
