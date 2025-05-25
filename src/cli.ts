/*
    202402*pike
    Fairpost cli handler     
*/

import "./bootstrap.ts";

import Fairpost from "./services/Fairpost.ts";
import { JSONReplacer } from "./utilities.ts";
import { PlatformId } from "./platforms/index.ts";
import { SourceStage, PostStatus } from "./types/index.ts";
import Operator from "./models/Operator.ts";
import User from "./models/User.ts";

// arguments
const USER = process.argv[2]?.includes("@")
  ? process.argv[2].replace("@", "")
  : "";
const COMMAND = process.argv[2]?.includes("@")
  ? (process.argv[3] ?? "help")
  : (process.argv[2] ?? "help");

// options
const DRY_RUN = !!getOption("dry-run");
const OPERATOR = (getOption("operator") as string) ?? "admin";
const PASSWORD = (getOption("password") as string) ?? undefined;
const PLATFORMS =
  ((getOption("platforms") as string)?.split(",") as PlatformId[]) ?? undefined;
const SOURCES = (getOption("sources") as string)?.split(",") ?? undefined;
const DATE = (getOption("date") as string) ?? undefined;
const STATUS = (getOption("status") as PostStatus) ?? undefined;
const STAGE = (getOption("stage") as SourceStage) ?? undefined;

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
  const user =
    USER && COMMAND !== "create-user" ? await User.getUser(USER) : undefined;

  try {
    const output = await Fairpost.execute(operator, user, COMMAND, {
      dryrun: DRY_RUN,
      user: USER,
      password: PASSWORD,
      platforms: PLATFORMS,
      platform: PLATFORM,
      sources: SOURCES,
      source: SOURCE,
      date: DATE ? new Date(DATE) : undefined,
      status: STATUS,
      stage: STAGE,
    });

    console.info(JSON.stringify(output, JSONReplacer, "\t"));
  } catch (e) {
    console.error((e as Error).message ?? e);
  }
}

main();
