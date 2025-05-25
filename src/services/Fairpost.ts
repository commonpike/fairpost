import log4js from "log4js";
import log4jsConfig from "../config/log4js.json" with { type: "json" };

import { CommandArguments, CombinedResult } from "../types/index.ts";
import { PlatformId } from "../platforms/index.ts";
import {
  FeedDto,
  PlatformDto,
  PostDto,
  SourceDto,
  UserDto,
  SourceStage,
} from "../types/index.ts";

import Post from "../models/Post.ts";
import Server from "../services/Server.ts";
import AuthService from "../services/AuthService.ts";
import Operator from "../models/Operator.ts";
import User from "../models/User.ts";

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
    }
  | { success: boolean; message?: string; messages?: string[] };

/**
 * Fairpost - singleton
 *
 * A command handler for the Fairpost framework
 * Fairpost has its own logger, but the commands user has their own logs too.
 */

class Fairpost {
  static instance: Fairpost;
  public logger: log4js.Logger;
  constructor() {
    if (Fairpost.instance) {
      throw new Error("CommandHandler: call getInstance() instead");
    }
    log4js.configure(log4jsConfig);
    this.logger = log4js.getLogger("default");
  }
  /**
   * Get the instance of the singleton
   */

  static getInstance(): Fairpost {
    if (!Fairpost.instance) {
      Fairpost.instance = new Fairpost();
    }
    return Fairpost.instance;
  }

  /**
   * Execute a command
   * @param operator - the operator executing the command
   * @param user - the user executing the command, if any
   * @param command - the command to execute
   * @param args - the arguments for the command
   * @returns a promise that resolves to the output of the command
   * @throws Error if the command is not recognized or if the user does not have the required permissions
   * @throws Error if the command fails
   */

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
        user.log.info(
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
          if (!args.user) {
            throw new Error("user is required for command " + command);
          }
          const newUser = await User.createUser(args.user);
          if (args.password) {
            AuthService.setPassword(newUser, args.password);
          }
          output = await newUser.mapper.getDto(operator);
          break;
        }

        case "login": {
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          if (!args.password) {
            throw new Error("password is required for command " + command);
          }
          const token = await AuthService.login(user, args.password);
          output = { success: !!token };
          break;
        }

        case "logout": {
          if (!permissions.manageAccount) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          await AuthService.logout(user);
          output = { success: true };
          break;
        }

        case "set-password": {
          if (!permissions.manageAccount) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          if (!args.password) {
            throw new Error("password is required for command " + command);
          }
          await AuthService.setPassword(user, args.password);
          output = { success: true };
          break;
        }

        case "refresh-token": {
          if (!permissions.manageAccount) {
            throw new Error("Missing permissions for command " + command);
          }
          if (!user) {
            throw new Error("user is required for command " + command);
          }
          const result = await AuthService.generateToken(user);
          output = { success: true, result: result.token };
          break;
        }

        case "get-users": {
          const users = await User.getUsers(!permissions.manageUsers);
          output = await Promise.all(
            users.map((user) => user.mapper.getDto(operator)),
          );
          break;
        }

        case "get-user": {
          if (!user) {
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
            throw user.log.error(
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
            throw user.log.error(
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
            throw user.log.error(
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
            throw user.log.error(
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
            throw user.log.error(
              "CommandHandler " + command,
              "Missing argument: source",
            );
          }
          const feed = user.getFeed();
          const source = await feed.getSource(args.source, args.stage);
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
          const sources = await feed.getSources(args.sources, args.stage);
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
            throw user.log.error(
              "CommandHandler " + command,
              "Missing argument: source",
            );
          }
          if (!args.platform) {
            throw user.log.error(
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
          const sources = await feed.getSources(args.sources, args.stage);
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
            throw user.log.error(
              "CommandHandler " + command,
              "Missing argument: source",
            );
          }
          if (!args.platform) {
            throw user.log.error(
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
          // by default, prepare posts from incoming
          if (!args.sources && !args.stage) {
            args.stage = SourceStage.INCOMING;
          }
          const feed = user.getFeed();
          const sources = await feed.getSources(args.sources, args.stage);
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
                user.log.error("Fairpost", "preparePosts", e);
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
            throw user.log.error(
              "CommandHandler " + command,
              "Missing argument: source",
            );
          }
          if (!args.platform) {
            throw user.log.error(
              "CommandHandler " + command,
              "Missing argument: platform",
            );
          }
          if (!args.date) {
            throw user.log.error(
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
            throw user.log.error(
              "CommandHandler " + command,
              "Missing argument: source",
            );
          }
          if (!args.date) {
            throw user.log.error(
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
            throw user.log.error(
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
            throw user.log.error(
              "CommandHandler " + command,
              "Missing argument: source",
            );
          }
          if (!args.platform) {
            throw user.log.error(
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
              dryrun: !!args.dryrun,
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
            throw user.log.error(
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
                dryrun: !!args.dryrun,
                result: post.link,
              };
            } catch (e) {
              output[platform.id] = {
                success: false,
                dryrun: !!args.dryrun,
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
          // TODO by default, schedule posts from incoming
          //if (!args.sources && !args.stage) {
          //  args.stage = SourceStage.INCOMING;
          //}
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
          // by default, publist due posts from active,
          // because that is where scheduled posts are
          if (!args.sources && !args.stage) {
            args.stage = SourceStage.ACTIVE;
          }
          const feed = user.getFeed();
          const sources = await feed.getSources(args.sources,args.stage);
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
            message: await Server.serve(),
          };

          break;
        }

        default: {
          const cmd = "fairpost:";
          output = {
            success: true,
            messages: [
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
              `${cmd} @userid get-source --source=xxx [--stage=xxx] `,
              `${cmd} @userid get-sources [--sources=xxx,xxx|--stage=xxx]`,
              `${cmd} @userid get-post --post=xxx:xxx`,
              `${cmd} @userid get-posts [--status=xxx] [--sources=xxx,xxx|--stage=xxx] [--platforms=xxx,xxx] `,
              `${cmd} @userid prepare-post --post=xxx:xxx`,
              `${cmd} @userid schedule-post --post=xxx:xxx --date=xxxx-xx-xx `,
              `${cmd} @userid schedule-posts [--source=xxx] [--platforms=xxx,xxx|--platform=xxx] --date=xxxx-xx-xx`,
              `${cmd} @userid schedule-next-post --platform=xxx [--date=xxxx-xx-xx]`,
              `${cmd} @userid publish-post --post=xxx:xxx [--dry-run]`,
              `${cmd} @userid publish-posts [--source=xxx] [--platforms=xxx,xxx|--platform=xxx]`,
              "\n# feed planning:",
              `${cmd} @userid prepare-posts  [--sources=xxx,xxx|--source=xxx|--stage=xxx] [--platforms=xxx,xxx|--platform=xxx]`,
              `${cmd} @userid schedule-next-posts [--date=xxxx-xx-xx] [--sources=xxx,xxx|--stage] [--platforms=xxx,xxx] `,
              `${cmd} @userid publish-due-posts [--sources=xxx,xxx|--stage=xxx] [--platforms=xxx,xxx] [--dry-run]`,
              "\n# account mgmt:",
              `${cmd} @userid login --password=xxx`,
              `${cmd} @userid logout`,
              `${cmd} @userid set-password --password=xxx`,
              `${cmd} @userid refresh-token`,
              "\n# admin only:",
              `${cmd} @userid create-user`,
              `${cmd} serve`,
            ],
          };
        }
      }
      if (!output) {
        throw this.logger.error("Fairpost.execute", "no output");
      }
      return output;
    } catch (e) {
      this.logger.error("Fairpost.execute", e);
      // the caller may handle the error
      throw e;
    }
  }
}

export default Fairpost.getInstance();
