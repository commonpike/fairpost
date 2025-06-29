/*
    202501*pike
    Fairpost cli to start server     
*/

import "./bootstrap.ts";

import Fairpost from "./services/Fairpost.ts";
import { JSONReplacer } from "./utilities.ts";
import Operator from "./models/Operator.ts";

async function main() {
  const operator = new Operator("admin", ["admin"], "cli", true);
  const output = await Fairpost.execute(operator, undefined, "serve");
  console.log(JSON.stringify(output, JSONReplacer, "\t"));
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
