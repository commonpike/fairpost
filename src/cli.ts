/*
    202402*pike
    Fairpost cli handler     
*/

import CommandHandler from "./services/CommandHandler";
import { JSONReplacer } from "./utilities";
import { PlatformId } from "./platforms";
import { PostStatus } from "./models/Post";
import User from "./models/User";

// arguments
const USER = process.argv[2]?.includes("@")
  ? process.argv[2].replace("@", "")
  : "admin";
const COMMAND = process.argv[2]?.includes("@")
  ? process.argv[3] ?? "help"
  : process.argv[2] ?? "help";

// options
const DRY_RUN = !!getOption("dry-run") ?? false;
const USERID = (getOption("userid") as string) ?? "";
const OUTPUT = (getOption("output") as string) ?? "text";
const PLATFORMS =
  ((getOption("platforms") as string)?.split(",") as PlatformId[]) ?? undefined;
const SOURCES = (getOption("sources") as string)?.split(",") ?? undefined;
const DATE = (getOption("date") as string) ?? undefined;
const STATUS = (getOption("status") as PostStatus) ?? undefined;

let PLATFORM = (getOption("platform") as string as PlatformId) ?? undefined;
let SOURCE = (getOption("source") as string) ?? undefined;
const POST = (getOption("post") as string) ?? undefined;
if (POST) {
  [SOURCE, PLATFORM] = POST.split(":") as [string, PlatformId];
}

// utilities
function getOption(key: string): boolean | string | null {
  if (process.argv.includes(`--${key}`)) return true;
  const value = process.argv.find((element) => element.startsWith(`--${key}=`));
  if (!value) return null;
  return value.replace(`--${key}=`, "");
}

async function main() {
  const user = new User(USER);

  try {
    const { result, report } = await CommandHandler.execute(user, COMMAND, {
      dryrun: DRY_RUN,
      userid: USERID,
      platforms: PLATFORMS,
      platform: PLATFORM,
      sources: SOURCES,
      source: SOURCE,
      date: DATE ? new Date(DATE) : undefined,
      status: STATUS,
    });

    switch (OUTPUT) {
      case "json": {
        console.log(JSON.stringify(result, JSONReplacer, "\t"));
        break;
      }
      default: {
        console.log(report);
      }
    }
  } catch (e) {
    console.error((e as Error).message ?? e);
  }
}

main();
