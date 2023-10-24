/*
    202309*pike
    Fairpost cli handler     
*/

import * as path from "path";
import Logger from "./src/Logger";
import Feed from "./src/Feed";
import { PostStatus } from "./src/Post";
import { PlatformId } from "./src/platforms";
import Facebook from "./src/platforms/Facebook";

// arguments
const COMMAND = process.argv[2] ?? "help";

// options
const CONFIG = (getOption("config") as string) ?? ".env";
const DRY_RUN = !!getOption("dry-run") ?? false;
const REPORT = (getOption("report") as string) ?? "text";
const PLATFORMS =
  ((getOption("platforms") as string)?.split(",") as PlatformId[]) ?? undefined;
const PLATFORM = (getOption("platform") as string as PlatformId) ?? undefined;
const FOLDERS = (getOption("folders") as string)?.split(",") ?? undefined;
const FOLDER = (getOption("folder") as string) ?? undefined;
const DATE = (getOption("date") as string) ?? undefined;
const STATUS = (getOption("status") as PostStatus) ?? undefined;

// utilities

function getOption(key: string): boolean | string | null {
  if (process.argv.includes(`--${key}`)) return true;
  const value = process.argv.find((element) => element.startsWith(`--${key}=`));
  if (!value) return null;
  return value.replace(`--${key}=`, "");
}

/* main */
async function main() {
  let result: unknown;
  let report = "";

  const feed = new Feed(CONFIG);
  Logger.trace(
    "Fairpost " + feed.id + " " + COMMAND,
    DRY_RUN ? " dry-run" : "",
  );

  try {
    switch (COMMAND) {
      case "get-feed": {
        result = feed;
        report = "Feed: " + feed.id;
        break;
      }
      case "get-platform": {
        const platform = feed.getPlatform(PLATFORM);
        report += "Platform: " + platform.id + "\n";
        result = platform;
        break;
      }
      case "get-platforms": {
        const platforms = feed.getPlatforms(PLATFORMS);
        platforms.forEach((platform) => {
          report += "Platform: " + platform.id + "\n";
        });
        result = platforms;
        break;
      }
      case "test-platform": {
        result = await feed.testPlatform(PLATFORM);
        report = "Result: \n" + JSON.stringify(result, null, "\t");
        break;
      }
      case "test-platforms": {
        result = await feed.testPlatforms(PLATFORMS);
        report = "Result: \n" + JSON.stringify(result, null, "\t");
        break;
      }
      case "get-folder": {
        const folder = feed.getFolder(FOLDER);
        report += "Folder: " + folder.id + "\n";
        result = folder;
        break;
      }
      case "get-folders": {
        const folders = feed.getFolders(FOLDERS);
        folders.forEach((folder) => {
          report += "Folder: " + folder.id + "\n";
        });
        result = folders;
        break;
      }
      case "get-post": {
        const post = feed.getPost(FOLDER, PLATFORM);
        report += post.report();
        result = post;
        break;
      }
      case "get-posts": {
        const allposts = feed.getPosts({
          folders: FOLDERS,
          platforms: PLATFORMS,
          status: STATUS,
        });
        allposts.forEach((post) => {
          report += post.report();
        });
        result = allposts;
        break;
      }
      case "prepare-post": {
        const preppost = await feed.preparePost(FOLDER, PLATFORM);
        report += preppost.report();
        result = preppost;
        break;
      }
      case "prepare-posts": {
        const prepposts = await feed.preparePosts({
          folders: FOLDERS,
          platforms: PLATFORMS,
        });
        prepposts.forEach((post) => {
          report += post.report();
        });
        result = prepposts;
        break;
      }
      case "schedule-post": {
        const schedpost = feed.schedulePost(FOLDER, PLATFORM, new Date(DATE));
        report += schedpost.report();
        result = schedpost;
        break;
      }
      case "schedule-posts": {
        const schedposts = feed.schedulePosts(
          {
            folders: FOLDERS,
            platforms: PLATFORMS,
          },
          new Date(DATE),
        );
        schedposts.forEach((post) => {
          report += post.report();
        });
        result = schedposts;
        break;
      }
      case "publish-post": {
        const pubpost = await feed.publishPost(FOLDER, PLATFORM, DRY_RUN);
        report += pubpost.report();
        result = pubpost;
        break;
      }
      case "publish-posts": {
        const pubposts = await feed.publishPosts(
          {
            folders: FOLDERS,
            platforms: PLATFORMS,
          },
          DRY_RUN,
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
          DATE ? new Date(DATE) : undefined,
          {
            folders: FOLDERS,
            platforms: PLATFORMS,
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
            folders: FOLDERS,
            platforms: PLATFORMS,
          },
          DRY_RUN,
        );
        dueposts.forEach((post) => {
          report += post.report();
        });
        result = dueposts;
        break;
      }
      /* platform specific tools */
      case "facebook-get-page-token": {
        const facebook = new Facebook();
        result = await facebook.getPageToken();
        report = "Page Token: " + result;
        break;
      }
      default: {
        const cmd = path.basename(process.argv[1]);
        result = [
          "# basic commands:",
          `${cmd} help`,
          `${cmd} get-feed [--config=xxx]`,
          `${cmd} test-platform --platform=xxx`,
          `${cmd} test-platforms [--platforms=xxx,xxx]`,
          `${cmd} get-platform --platform=xxx`,
          `${cmd} get-platforms [--platforms=xxx,xxx]`,
          `${cmd} get-folder --folder=xxx`,
          `${cmd} get-folders [--folders=xxx,xxx]`,
          `${cmd} get-post --folder=xxx --platform=xxx`,
          `${cmd} get-posts [--status=xxx] [--folders=xxx,xxx] [--platforms=xxx,xxx] `,
          `${cmd} prepare-post --folder=xxx --platform=xxx`,
          `${cmd} schedule-post --folder=xxx --platform=xxx --date=xxxx-xx-xx `,
          `${cmd} schedule-posts [--folders=xxx,xxx] [--platforms=xxx,xxx] --date=xxxx-xx-xx`,
          `${cmd} publish-post --folders=xxx --platforms=xxx [--dry-run]`,
          `${cmd} publish-posts [--folders=xxx,xxx] [--platforms=xxx,xxx]`,
          "\n# feed planning:",
          `${cmd} prepare-posts [--folders=xxx,xxx] [--platforms=xxx,xxx]`,
          `${cmd} schedule-next-post [--date=xxxx-xx-xx] [--folders=xxx,xxx] [--platforms=xxx,xxx] `,
          `${cmd} publish-due-posts [--folders=xxx,xxx] [--platforms=xxx,xxx] [--dry-run]`,
          "\n# platform tools:",
          `${cmd} facebook-get-page-token --app-user-id=xxx --user-token=xxx`,
        ];
        (result as string[]).forEach((line) => (report += "\n" + line));
      }
    }
  } catch (e) {
    console.error(e.message);
  }

  switch (REPORT) {
    case "json": {
      console.log(JSON.stringify(result, null, "\t"));
      break;
    }
    default: {
      console.log(report);
    }
  }
}

main();
