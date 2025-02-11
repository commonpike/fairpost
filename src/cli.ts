/*
    202402*pike
    Fairpost cli handler     
*/

import * as dotenv from "dotenv";
dotenv.config();

import Fairpost from "./services/Fairpost";
import { JSONReplacer } from "./utilities";
import { PlatformId } from "./platforms";
import { PostStatus } from "./models/Post";
import Operator from "./models/Operator";
import User from "./models/User";

// arguments
const USER = process.argv[2]?.includes("@")
  ? process.argv[2].replace("@", "")
  : "";
const COMMAND = process.argv[2]?.includes("@")
  ? process.argv[3] ?? "help"
  : process.argv[2] ?? "help";

// options
const DRY_RUN = !!getOption("dry-run");
const OPERATOR = (getOption("operator") as string) ?? "admin";
const TARGETUSER = (getOption("target-user") as string) ?? "";
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

// main
async function main() {
  const operator = new Operator(OPERATOR, ["admin"], "cli", true);
  const user = USER ? new User(USER) : undefined;

  try {
    await user?.load();
    const output = await Fairpost.execute(operator, user, COMMAND, {
      dryrun: DRY_RUN,
      targetuser: TARGETUSER,
      platforms: PLATFORMS,
      platform: PLATFORM,
      sources: SOURCES,
      source: SOURCE,
      date: DATE ? new Date(DATE) : undefined,
      status: STATUS,
    });

    console.info(JSON.stringify(output, JSONReplacer, "\t"));
  } catch (e) {
    console.error((e as Error).message ?? e);
  }
}

main();
