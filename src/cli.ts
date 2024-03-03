/*
    202402*pike
    Fairpost cli handler     
*/

import CommandHandler from "./services/CommandHandler";
import { PlatformId } from "./platforms";
import { PostStatus } from "./models/Post";
import User from "./models/User";

// arguments
const USER = process.argv[2]?.includes('@') ? process.argv[2].replace('@','') : "admin";
const COMMAND = process.argv[2]?.includes('@') ? process.argv[3] ?? "help" : process.argv[2];

// options
const DRY_RUN = !!getOption("dry-run") ?? false;
const REPORT = (getOption("report") as string) ?? "text";
const PLATFORMS =
  ((getOption("platforms") as string)?.split(",") as PlatformId[]) ?? undefined;
const FOLDERS = (getOption("folders") as string)?.split(",") ?? undefined;
const DATE = (getOption("date") as string) ?? undefined;
const STATUS = (getOption("status") as PostStatus) ?? undefined;

let PLATFORM = (getOption("platform") as string as PlatformId) ?? undefined;
let FOLDER = (getOption("folder") as string) ?? undefined;
const POST = (getOption("post") as string) ?? undefined;
if (POST) {
  [FOLDER, PLATFORM] = POST.split(":") as [string, PlatformId];
}
// utilities

function getOption(key: string): boolean | string | null {
  if (process.argv.includes(`--${key}`)) return true;
  const value = process.argv.find((element) => element.startsWith(`--${key}=`));
  if (!value) return null;
  return value.replace(`--${key}=`, "");
}

async function main() {
  let result: unknown;
  let report = "";

  const user = new User(USER);

  try {
    ({result,report} = await CommandHandler.execute(user,COMMAND,{
      dryrun: DRY_RUN,
      platforms: PLATFORMS,
      platform: PLATFORM,
      folders: FOLDERS,
      folder: FOLDER,
      date: DATE ? new Date(DATE) : undefined,
      status: STATUS
    }));
  } catch (e) {
    console.error((e as Error).message ?? e);
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
