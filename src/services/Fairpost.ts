/**
 * Fairpost - singleton
 *
 * A command handler for the Fairpost framework
 * Fairpost has its own logger, but the commands user has their own logs too.
 */
import * as log4js from "log4js";
import { CombinedResult } from "../types";
import { PlatformId } from "../platforms";
import { FeedDto } from "../mappers/FeedMapper";
import { PlatformDto } from "../mappers/PlatformMapper";
import { PostDto } from "../mappers/PostMapper";
import { SourceDto } from "../mappers/SourceMapper";
import { UserDto } from "../mappers/UserMapper";

import Post, { PostStatus } from "../models/Post";
import Server from "../services/Server";
import Operator from "../models/Operator";
import User from "../models/User";

type FairpostOutput =
  | FeedDto
  | PlatformDto
  | PostDto
  | SourceDto
  | UserDto
  | FeedDto[]
  | PlatformDto[]
  | PostDto[]
  | SourceDto[]
  | UserDto[]
  | CombinedResult[]
  | {
      [id in PlatformId]?: CombinedResult | CombinedResult[];
    };

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
  ): Promise<FairpostOutput> {
    try {
      let output: undefined | FairpostOutput = undefined;

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
          const newUser = await User.createUser(args.targetuser);
          output = await newUser.mapper.getDto(operator);
          break;
        }
        case "get-user": {
          // todo: remove target-user option, we have operator now
          if (args.targetuser) {
            if (!permissions.manageUsers) {
              throw new Error("Missing permissions for command " + command);
            }
            const other = new User(args.targetuser);
            output = await other.mapper.getDto(operator);
          } else if (!user) {
            throw new Error("Missing user for command " + command);
          } else {
            output = await user.mapper.getDto(operator);
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
          output = await feed.mapper.getDto(operator);
          break;
        }
        case "setup-platform": {
          if (!permissions.manageFeed) {
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
          const platform = user.getPlatform(args.platform);
          await platform.setup();
          output = {
            [args.platform]: {
              success: true,
              result: await platform.test(),
            },
          };
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
          const platform = user.getPlatform(args.platform);
          output = await platform.mapper.getDto(operator);
          break;
        }
        case "get-platforms": {
          if (!permissions.managePlatforms) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const platforms = user.getPlatforms(args.platforms);
          output = await Promise.all(
            platforms.map((p) => p.mapper.getDto(operator)),
          );

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
          const platform = user.getPlatform(args.platform);
          output = {
            [args.platform]: {
              success: true,
              result: await platform.test(),
            },
          };
          break;
        }
        case "test-platforms": {
          if (!permissions.managePlatforms) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const platforms = user.getPlatforms();
          output = {} as { [id in PlatformId]: CombinedResult };
          for (const platform of platforms) {
            try {
              output[platform.id] = {
                success: true,
                result: await platform.test(),
              };
            } catch (e) {
              output[platform.id] = {
                success: false,
                message: e instanceof Error ? e.message : JSON.stringify(e),
              };
            }
          }
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
          const platform = user.getPlatform(args.platform);
          const refreshed = await platform.refresh();
          output = {
            [args.platform]: {
              success: true,
              message: refreshed
                ? "Platform refreshed"
                : "Platform not refreshed",
            },
          };
          break;
        }
        case "refresh-platforms": {
          if (!permissions.managePlatforms) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const platforms = user.getPlatforms(args.platforms);
          output = {} as { [id in PlatformId]: CombinedResult };
          for (const platform of platforms) {
            try {
              const refreshed = await platform.refresh();
              output[platform.id] = {
                success: true,
                result: refreshed
                  ? "Platform refreshed"
                  : "Platform not refreshed",
              };
            } catch (e) {
              output[platform.id] = {
                success: false,
                message: e instanceof Error ? e.message : JSON.stringify(e),
              };
            }
          }
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
          const source = await feed.getSource(args.source);
          output = await source.mapper.getDto(operator);
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
          const sources = await feed.getSources(args.sources);
          output = await Promise.all(
            sources.map((source) => source.mapper.getDto(operator)),
          );
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
          const platform = user.getPlatform(args.platform);
          const source = await feed.getSource(args.source);
          const post = await platform.getPost(source);
          output = await post.mapper.getDto(operator);
          break;
        }
        case "get-posts": {
          if (!permissions.readPosts) {
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
          const platforms = user.getPlatforms(args.platforms);
          const sources = await feed.getSources(args.sources);
          const posts = [] as Post[];
          for (const platform of platforms) {
            posts.push(...(await platform.getPosts(sources, args.status)));
          }
          output = await Promise.all(
            posts.map((p) => p.mapper.getDto(operator)),
          );
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
          const platform = user.getPlatform(args.platform);
          const feed = user.getFeed();
          const source = await feed.getSource(args.source);
          const post = await platform.preparePost(source);
          output = await post.mapper.getDto(operator);
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
          const sources = await feed.getSources(args.sources);
          const platforms = user.getPlatforms(args.platforms);
          output = {} as { [id in PlatformId]?: CombinedResult[] };
          for (const platform of platforms) {
            for (const source of sources) {
              if (!output[platform.id]) {
                output[platform.id] = [];
              }
              try {
                const post = await platform.preparePost(source);
                (output[platform.id] as CombinedResult[]).push({
                  success: true,
                  result: await post.mapper.getDto(operator),
                });
              } catch (e) {
                user.error("Fairpost", "preparePosts", e);
                (output[platform.id] as CombinedResult[]).push({
                  success: false,
                  message: e instanceof Error ? e.message : JSON.stringify(e),
                });
              }
            }
          }
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
          const source = await feed.getSource(args.source);
          const platform = user.getPlatform(args.platform);
          const post = await platform.getPost(source);
          post.schedule(args.date);
          output = await post.mapper.getDto(operator);
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
          if (!args.source && args.sources) {
            args.source = args.sources[0];
          }
          if (!args.source) {
            throw user.error(
              "CommandHandler " + command,
              "Missing argument: source",
            );
          }
          if (!args.date) {
            throw user.error(
              "CommandHandler " + command,
              "Missing argument: date",
            );
          }
          const feed = user.getFeed();
          const source = await feed.getSource(args.source);
          const platforms = user.getPlatforms(args.platforms);
          output = {} as { [id in PlatformId]: CombinedResult };
          for (const platform of platforms) {
            try {
              const post = await platform.getPost(source);
              post.schedule(args.date);
              output[platform.id] = {
                success: true,
                result: await post.mapper.getDto(operator),
              };
            } catch (e) {
              output[platform.id] = {
                success: false,
                message: e instanceof Error ? e.message : JSON.stringify(e),
              };
            }
          }
          break;
        }
        case "schedule-next-post": {
          if (!permissions.schedulePosts) {
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
          const platform = user.getPlatform(args.platform);
          const post = await platform.scheduleNextPost(
            args.date ? new Date(args.date) : undefined,
          );
          if (post) {
            output = await post.mapper.getDto(operator);
          } else {
            output = { success: false, message: "No post left to schedule" };
          }
          break;
        }
        case "publish-post": {
          if (!permissions.publishPosts) {
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
          const platform = user.getPlatform(args.platform);
          const feed = user.getFeed();
          const source = await feed.getSource(args.source);
          const post = await platform.getPost(source);
          output = {
            [platform.id]: {
              success: await post.publish(!!args.dryrun),
              result: post.link ?? "#nolink",
            },
          };
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
          if (!args.source && args.sources) {
            args.source = args.sources[0];
          }
          if (!args.source) {
            throw user.error(
              "CommandHandler " + command,
              "Missing argument: source",
            );
          }
          const feed = user.getFeed();
          const source = await feed.getSource(args.source);
          const platforms = user.getPlatforms(args.platforms);
          output = {} as { [id in PlatformId]: CombinedResult };
          for (const platform of platforms) {
            try {
              const post = await platform.getPost(source);
              await post.publish(!!args.dryrun);
              output[platform.id] = {
                success: await post.publish(!!args.dryrun),
                result: post.link,
              };
            } catch (e) {
              output[platform.id] = {
                success: false,
                message: e instanceof Error ? e.message : JSON.stringify(e),
              };
            }
          }
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
          if (!args.platforms && args.platform) {
            args.platforms = [args.platform];
          }
          if (!args.sources && args.source) {
            args.sources = [args.source];
          }
          const feed = user.getFeed();
          const sources = await feed.getSources(args.sources);
          const platforms = user.getPlatforms(args.platforms);
          const posts = [] as Post[];
          for (const platform of platforms) {
            const post = await platform.scheduleNextPost(
              args.date ? new Date(args.date) : undefined,
              sources,
            );
            if (post) posts.push(post);
          }
          output = await Promise.all(
            posts.map((p) => p.mapper.getDto(operator)),
          );
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
          const sources = await feed.getSources(args.sources);
          const platforms = user.getPlatforms(args.platforms);
          output = {} as { [id in PlatformId]: CombinedResult };
          for (const platform of platforms) {
            try {
              const post = await platform.publishDuePost(
                sources,
                !!args.dryrun,
              );
              if (post) {
                output[platform.id] = {
                  success: true,
                  result: post.link,
                };
              } else {
                output[platform.id] = {
                  success: true,
                  message: "No posts due",
                };
              }
            } catch (e) {
              output[platform.id] = {
                success: false,
                message: e instanceof Error ? e.message : JSON.stringify(e),
              };
            }
          }
          break;
        }

        case "serve": {
          if (!permissions.manageServer) {
            throw new Error("Missing permissions for command " + command);
          }
          output = {
            success: true,
            result: await Server.serve(),
          };

          break;
        }

        default: {
          const cmd = "fairpost:";
          output = {
            succes: true,
            result: [
              "# basic commands:",
              `${cmd} help`,
              `${cmd} @userid get-user`,
              `${cmd} @userid get-feed`,
              `${cmd} @userid setup-platform --platform=xxx`,
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
              `${cmd} @userid schedule-next-post --platform=xxx [--date=xxxx-xx-xx]`,
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
            ],
          };
        }
      }
      return (
        output ?? {
          success: false,
          message: "No output",
        }
      );
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
