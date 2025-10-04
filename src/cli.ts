/*
    202402*pike
    Fairpost cli handler     
*/

import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

import "./bootstrap.ts";

import Fairpost from "./services/Fairpost.ts";
import { JSONReplacer, parsePayload } from "./utilities.ts";
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

// payload
const chunks: Buffer[] = [];
if (!process.stdin.isTTY) {
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
}
let PAYLOAD = chunks.length
  ? await parsePayload(Buffer.concat(chunks))
  : undefined;

// utilities
function getOption(key: string): boolean | string | null {
  if (process.argv.includes(`--${key}`)) return true;
  const value = process.argv.find((element) => element.startsWith(`--${key}=`));
  if (!value) return null;
  return value.replace(`--${key}=`, "");
}

async function editPayload(getCommand: string, putCommand: string) {
  const tmpFile = path.join(os.tmpdir(), "fairpost.tmp");
  fs.writeFileSync(tmpFile, await execute(getCommand), "utf8");
  const edit = spawnSync(`${process.env.EDITOR || "nano"} "${tmpFile}"`, {
    stdio: "inherit",
    shell: true,
  });
  if (edit.error) {
    console.error("Failed to launch editor:", edit.error);
    process.exit(1);
  }
  if (edit.status !== 0) {
    console.warn(
      `Editor exited with code ${edit.status} — assuming user cancelled.`,
    );
    process.exit(1);
  }
  PAYLOAD = await parsePayload(fs.readFileSync(tmpFile));
  return await execute(putCommand);
}

// main
async function execute(command: string): Promise<string> {
  const operator = new Operator(OPERATOR, ["admin"], "cli", true);
  const user =
    USER && COMMAND !== "create-user" ? await User.getUser(USER) : undefined;

  try {
    const output = await Fairpost.execute(operator, user, command, {
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
      payload: PAYLOAD,
    });

    return JSON.stringify(output, JSONReplacer, "\t");
  } catch (e) {
    console.error((e as Error).message ?? e);
    throw e;
  }
}

switch (COMMAND) {
  case "edit-platform":
    console.info(await editPayload("get-platform", "put-platform"));
    break;
  default:
    console.info(await execute(COMMAND));
}
