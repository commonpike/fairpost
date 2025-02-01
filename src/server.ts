/*
    202501*pike
    Fairpost cli to start server     
*/

import * as dotenv from "dotenv";
dotenv.config();

import Fairpost from "./services/Fairpost";
import { JSONReplacer } from "./utilities";
import Operator from "./models/Operator";

async function main() {
  const operator = new Operator("admin", ["admin"], "cli", true);
  const output = await Fairpost.execute(operator, undefined, "serve");
  console.log(JSON.stringify(output, JSONReplacer, "\t"));
}

main();
