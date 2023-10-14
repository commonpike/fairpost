import * as log4js from "log4js";
import * as path from "path";
log4js.configure(path.resolve(__dirname + "/../../log4js.json"));
export default log4js.getLogger("default");
