/**
 * CommandHandler - minimalist singleton service
 *
 * Executes commands on behalf of a user
 *
 */

import { PlatformId } from "../platforms";
import { PostStatus } from "../models/Post";
import Server from "../services/Server";
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

    const feed = user.getFeed();
    user.trace(
      "Fairpost " + user.id + " - " + feed.id + " " + command,
      args.dryrun ? " dry-run" : "",
    );

    switch (command) {
      case "get-user": {
        result = user;
        report = user.report();
        break;
      }
      case "get-feed": {
        result = feed;
        report = feed.report();
        break;
      }
      case "setup-platform": {
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
        await feed.setupPlatforms(args.platforms);
        result = "Success"; // or error
        report = "Result: \n" + JSON.stringify(result, null, "\t");
        break;
      }
      case "get-platform": {
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
        const platforms = feed.getPlatforms(args.platforms);
        report += platforms.length + " Platforms\n------\n";
        platforms.forEach((platform) => {
          report += platform.report() + "\n";
        });
        result = platforms;
        break;
      }
      case "test-platform": {
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
        result = await feed.testPlatforms(args.platforms);
        report = "Result: \n" + JSON.stringify(result, null, "\t");
        break;
      }
      case "refresh-platform": {
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
        result = await feed.refreshPlatforms(args.platforms);
        report = "Result: \n" + JSON.stringify(result, null, "\t");
        break;
      }
      case "get-folder": {
        if (!args.folder) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: folder",
          );
        }
        const folder = feed.getFolder(args.folder);
        if (folder) {
          report += folder.report() + "\n";
          result = folder;
        } else {
          report += "not found:" + args.folder + "\n";
        }
        break;
      }
      case "get-folders": {
        const folders = feed.getFolders(args.folders);
        report += folders.length + " Folders\n------\n";
        folders.forEach((folder) => {
          report += folder.report() + "\n";
        });
        result = folders;
        break;
      }
      case "get-post": {
        if (!args.folder) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: folder",
          );
        }
        if (!args.platform) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platform",
          );
        }
        const post = feed.getPost(args.folder, args.platform);
        if (post) {
          report += post.report();
          result = post;
        } else {
          report += "Not found:" + args.folder + ":" + args.platform;
        }
        break;
      }
      case "get-posts": {
        const allposts = feed.getPosts({
          folders: args.folders,
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
        if (!args.folder) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: folder",
          );
        }
        if (!args.platform) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platform",
          );
        }
        const preppost = await feed.preparePost(args.folder, args.platform);
        if (preppost) {
          report += preppost.report();
          result = preppost;
        } else {
          report += "Failed: " + args.folder + ":" + args.platform;
        }
        break;
      }
      case "prepare-posts": {
        if (!args.platforms && args.platform) {
          args.platforms = [args.platform];
        }
        if (!args.folders && args.folder) {
          args.folders = [args.folder];
        }
        const prepposts = await feed.preparePosts({
          folders: args.folders,
          platforms: args.platforms,
        });
        prepposts.forEach((post) => {
          report += post.report();
        });
        result = prepposts;
        break;
      }
      case "schedule-post": {
        if (!args.folder) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: folder",
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
          args.folder,
          args.platform,
          args.date,
        );
        report += schedpost.report();
        result = schedpost;
        break;
      }
      case "schedule-posts": {
        if (!args.platforms && args.platform) {
          args.platforms = [args.platform];
        }
        if (!args.folders && args.folder) {
          args.folders = [args.folder];
        }
        if (!args.folders) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: folders",
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
            folders: args.folders,
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
      case "publish-post": {
        if (!args.folder) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: folder",
          );
        }
        if (!args.platform) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: platform",
          );
        }
        const pubpost = await feed.publishPost(
          args.folder,
          args.platform,
          args.dryrun,
        );
        report += pubpost.report();
        result = pubpost;
        break;
      }
      case "publish-posts": {
        if (!args.platforms && args.platform) {
          args.platforms = [args.platform];
        }
        if (!args.folders && args.folder) {
          args.folders = [args.folder];
        }
        if (!args.folders) {
          throw user.error(
            "CommandHandler " + command,
            "Missing argument: folders",
          );
        }
        const pubposts = await feed.publishPosts(
          {
            folders: args.folders,
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
        const nextposts = feed.scheduleNextPosts(
          args.date ? new Date(args.date) : undefined,
          {
            folders: args.folders,
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
        const dueposts = await feed.publishDuePosts(
          {
            folders: args.folders,
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
          `${cmd} get-feed [--config=xxx]`,
          `${cmd} setup-platform --platform=xxx`,
          `${cmd} setup-platforms [--platforms=xxx,xxx]`,
          `${cmd} test-platform --platform=xxx`,
          `${cmd} test-platforms [--platforms=xxx,xxx]`,
          `${cmd} refresh-platform --platform=xxx`,
          `${cmd} refresh-platforms [--platforms=xxx,xxx]`,
          `${cmd} get-platform --platform=xxx`,
          `${cmd} get-platforms [--platforms=xxx,xxx]`,
          `${cmd} get-folder --folder=xxx`,
          `${cmd} get-folders [--folders=xxx,xxx]`,
          `${cmd} get-post --post=xxx:xxx`,
          `${cmd} get-posts [--status=xxx] [--folders=xxx,xxx] [--platforms=xxx,xxx] `,
          `${cmd} prepare-post --post=xxx:xxx`,
          `${cmd} schedule-post --post=xxx:xxx --date=xxxx-xx-xx `,
          `${cmd} schedule-posts [--folders=xxx,xxx|--folder=xxx] [--platforms=xxx,xxx|--platform=xxx] --date=xxxx-xx-xx`,
          `${cmd} publish-post --post=xxx:xxx [--dry-run]`,
          `${cmd} publish-posts [--folders=xxx,xxx|--folder=xxx] [--platforms=xxx,xxx|--platform=xxx]`,
          "\n# feed planning:",
          `${cmd} prepare-posts  [--folders=xxx,xxx|--folder=xxx] [--platforms=xxx,xxx|--platform=xxx]`,
          `${cmd} schedule-next-post [--date=xxxx-xx-xx] [--folders=xxx,xxx] [--platforms=xxx,xxx] `,
          `${cmd} publish-due-posts [--folders=xxx,xxx] [--platforms=xxx,xxx] [--dry-run]`,
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
  platforms?: PlatformId[];
  platform?: PlatformId;
  folders?: string[];
  folder?: string;
  date?: Date;
  status?: PostStatus;
}
export default CommandHandler.getInstance();
