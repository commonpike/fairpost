/*
    202501*pike
    Fairpost cli to start server     
*/

import * as dotenv from "dotenv";
dotenv.config();

import Fairpost from "./services/Fairpost";
import { JSONReplacer } from "./utilities";
import Operator from "./models/Operator";

// arguments
const OUTPUT = (getOption("output") as string) ?? "text";

// utilities
function getOption(key: string): boolean | string | null {
  if (process.argv.includes(`--${key}`)) return true;
  const value = process.argv.find((element) => element.startsWith(`--${key}=`));
  if (!value) return null;
  return value.replace(`--${key}=`, "");
}

async function main() {
  const operator = new Operator("admin", ["admin"], "cli", true);
  try {
    const { result, report } = await Fairpost.execute(
      operator,
      undefined,
      "serve",
    );

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
