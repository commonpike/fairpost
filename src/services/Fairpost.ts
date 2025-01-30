/**
 * Fairpost - singleton
 *
 * A command handler for the Fairpost framework
 * Fairpost has its own logger, but the commands user has their own logs too.
 */
import * as log4js from "log4js";

import { PlatformId } from "../platforms";
import { Dto } from "../mappers/AbstractMapper";
import { PostStatus } from "../models/Post";
import Server from "../services/Server";
import Source from "../models/Source";
import Operator from "../models/Operator";
import User from "../models/User";

class Fairpost {
  static instance: Fairpost;
  public logger: log4js.Logger;
  constructor() {
    if (Fairpost.instance) {
      throw new Error("CommandHandler: call getInstance() instead");
    }
    log4js.configure(process.env.FAIRPOST_LOGGER_CONFIG ?? "");
    this.logger = log4js.getLogger("default");
  }
  static getInstance(): Fairpost {
    if (!Fairpost.instance) {
      Fairpost.instance = new Fairpost();
    }
    return Fairpost.instance;
  }
  async execute(
    operator: Operator,
    user?: User,
    command: string = "help",
    args: CommandArguments = {},
  ): Promise<{
    result: unknown;
    report: string;
  }> {
    try {
      let result: unknown;
      let report = "";

      this.logger.info(
        "Fairpost ",
        operator.id,
        user?.id ?? "",
        command,
        args.dryrun ? " dry-run" : "",
      );
      if (user) {
        user.info(
          "Fairpost ",
          operator.id,
          command,
          args.dryrun ? " dry-run" : "",
        );
      }

      operator.validate();
      const permissions = operator.getPermissions(user);
      //console.log(operator,permissions);
      switch (command) {
        case "create-user": {
          if (!permissions.manageUsers) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!args.targetuser) {
            throw new Error("user is required for command " + command);
          }
          const newUser = User.createUser(args.targetuser);
          result = newUser.mapper.getDto(operator);
          report = newUser.mapper.getReport(operator);
          break;
        }
        case "get-user": {
          // todo: remove target-user option, we have operator now
          if (args.targetuser) {
            if (!permissions.manageUsers) {
              throw new Error("Missing permissions for command " + command);
            }
            const other = new User(args.targetuser);
            result = other.mapper.getDto(operator);
            report = other.mapper.getReport(operator);
          } else if (!user) {
            throw new Error("Missing user for command " + command);
          } else {
            result = user.mapper.getDto(operator);
            report = user.mapper.getReport(operator);
          }
          break;
        }
        case "get-feed": {
          if (!permissions.manageFeed) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const feed = user.getFeed();
          result = feed.mapper.getDto(operator);
          report = feed.mapper.getReport(operator);
          break;
        }
        case "setup-platform": {
          if (!permissions.manageFeed) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const feed = user.getFeed();
          if (!args.platform) {
            throw user.error(
              "CommandHandler " + command,
              "Missing argument: platform",
            );
          }
          result = await feed.setupPlatform(args.platform);
          report = "Result: \n" + JSON.stringify(result, null, "\t");

          break;
        }
        case "setup-platforms": {
          if (!permissions.managePlatforms) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const feed = user.getFeed();
          result = await feed.setupPlatforms(args.platforms);
          report = "Result: \n" + JSON.stringify(result, null, "\t");
          break;
        }
        case "get-platform": {
          if (!permissions.managePlatforms) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          if (!args.platform) {
            throw user.error(
              "CommandHandler " + command,
              "Missing argument: platform",
            );
          }
          const feed = user.getFeed();
          const platform = feed.getPlatform(args.platform);
          report += platform.mapper.getReport(operator);
          result = platform.mapper.getDto(operator);
          break;
        }
        case "get-platforms": {
          if (!permissions.managePlatforms) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const feed = user.getFeed();
          const platforms = feed.getPlatforms(args.platforms);
          report += platforms.length + " Platforms\n------\n";
          platforms.forEach((platform) => {
            report += platform.report() + "\n";
          });
          result = platforms;
          break;
        }
        case "test-platform": {
          if (!permissions.managePlatforms) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          if (!args.platform) {
            throw user.error(
              "CommandHandler " + command,
              "Missing argument: platform",
            );
          }
          const feed = user.getFeed();
          result = await feed.testPlatform(args.platform);
          report = "Result: \n" + JSON.stringify(result, null, "\t");
          break;
        }
        case "test-platforms": {
          if (!permissions.managePlatforms) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const feed = user.getFeed();
          result = await feed.testPlatforms(args.platforms);
          report = "Result: \n" + JSON.stringify(result, null, "\t");
          break;
        }
        case "refresh-platform": {
          if (!permissions.managePlatforms) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          if (!args.platform) {
            throw user.error(
              "CommandHandler " + command,
              "Missing argument: platform",
            );
          }
          const feed = user.getFeed();
          result = await feed.refreshPlatform(args.platform);
          report = "Result: \n" + JSON.stringify(result, null, "\t");
          break;
        }
        case "refresh-platforms": {
          if (!permissions.managePlatforms) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const feed = user.getFeed();
          result = await feed.refreshPlatforms(args.platforms);
          report = "Result: \n" + JSON.stringify(result, null, "\t");
          break;
        }
        case "get-source": {
          if (!permissions.manageSources) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          if (!args.source) {
            throw user.error(
              "CommandHandler " + command,
              "Missing argument: source",
            );
          }
          const feed = user.getFeed();
          const source = feed.getSource(args.source);
          if (source) {
            report += source.mapper.getReport(operator);
            result = source.mapper.getDto(operator);
          } else {
            report += "not found:" + args.source + "\n";
          }
          break;
        }
        case "get-sources": {
          if (!permissions.manageSources) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const feed = user.getFeed();
          const sources = feed.getSources(args.sources);
          const dtos = [] as Dto[];
          report += sources.length + " Sources\n------\n";
          sources.forEach((source) => {
            report += source.mapper.getReport(operator) + "\n";
            dtos.push(source.mapper.getDto(operator));
          });
          result = dtos;
          break;
        }
        case "get-sources-by-status": {
          if (!permissions.manageSources) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const feed = user.getFeed();
          const sources = feed.getSources(args.sources);

          const groups = {} as { [status: string]: Source[] };
          sources.forEach((source) => {
            const status = feed.getSourceStatus(source.path);
            if (groups[status] === undefined) {
              groups[status] = [];
            }
            groups[status].push(source);
          });
          const groupedDtos = {} as { [status: string]: Dto[] };
          for (const status in groups) {
            report += " " + status + "\n------\n";
            const sources = groups[status];
            report += sources.length + " Sources\n------\n";
            groupedDtos[status] = [];
            sources.forEach((source) => {
              report += source.mapper.getReport(operator) + "\n";
              groupedDtos[status].push(source.mapper.getDto(operator));
            });
          }
          result = groupedDtos;
          break;
        }
        case "get-post": {
          if (!permissions.readPosts) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
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
          const feed = user.getFeed();
          const post = feed.getPost(args.source, args.platform);
          if (post) {
            report += post.mapper.getReport(operator);
            result = post.mapper.getDto(operator);
          } else {
            report += "Not found:" + args.source + ":" + args.platform;
          }
          break;
        }
        case "get-posts": {
          if (!permissions.readPosts) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const feed = user.getFeed();
          const allposts = feed.getPosts({
            sources: args.sources,
            platforms: args.platforms,
            status: args.status,
          });
          report += allposts.length + " Posts\n------\n";
          const dtos = [] as Dto[];
          allposts.forEach((post) => {
            report += post.mapper.getReport(operator);
            dtos.push(post.mapper.getDto(operator));
          });
          result = dtos;
          break;
        }
        case "prepare-post": {
          if (!permissions.managePosts) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
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
          const feed = user.getFeed();
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
          if (!permissions.managePosts) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          if (!args.platforms && args.platform) {
            args.platforms = [args.platform];
          }
          if (!args.sources && args.source) {
            args.sources = [args.source];
          }
          const feed = user.getFeed();
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
          if (!permissions.schedulePosts) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
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
          const feed = user.getFeed();
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
          if (!permissions.schedulePosts) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
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
          const feed = user.getFeed();
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
          if (!permissions.schedulePosts) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          if (!args.platforms && args.platform) {
            args.platforms = [args.platform];
          }
          if (!args.platforms) {
            throw user.error(
              "CommandHandler " + command,
              "Missing argument: platforms",
            );
          }
          const feed = user.getFeed();
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
          if (!permissions.schedulePosts) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
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
          const feed = user.getFeed();
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
          if (!permissions.publishPosts) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
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
          const feed = user.getFeed();
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
          if (!permissions.schedulePosts) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const feed = user.getFeed();
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
          if (!permissions.publishPosts) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const feed = user.getFeed();
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
          if (!permissions.manageServer) {
            throw new Error("Missing permissions for command " + command);
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
            `${cmd} create-user --target-user=xxx`,
            `${cmd} get-user --target-user=xxx`,
            `${cmd} serve`,
          ];
          (result as string[]).forEach((line) => (report += "\n" + line));
        }
      }
      return {
        result: result,
        report: report,
      };
    } catch (e) {
      this.logger.error("Fairpost.execute", e);
      // the caller may handle the error
      throw e;
    }
  }
}
interface CommandArguments {
  dryrun?: boolean;
  targetuser?: string;
  platforms?: PlatformId[];
  platform?: PlatformId;
  sources?: string[];
  source?: string;
  date?: Date;
  status?: PostStatus;
}

export default Fairpost.getInstance();
