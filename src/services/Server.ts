import * as fs from "fs";
import * as http from "http";
import * as log4js from "log4js";

import CommandHandler from "./CommandHandler";
import { JSONReplacer } from "../utilities";
import { PlatformId } from "../platforms";
import { PostStatus } from "../models/Post";
import Operator from "../models/Operator";
import User from "../models/User";

/**
 * Server: start a webserver for an REST api
 */
export default class Server {
  public static async serve(): Promise<string> {
    process.env.FAIRPOST_UI = "api";
    const host = process.env.FAIRPOST_SERVER_HOSTNAME;
    const port = Number(process.env.FAIRPOST_SERVER_PORT);
    log4js.configure(process.env.FAIRPOST_LOGGER_CONFIG ?? "");
    const logger = log4js.getLogger("default");
    return await new Promise((resolve) => {
      const server = http.createServer((req,res) => {
        Server.handleRequest(req,res,logger);
      });
      server.listen(port, host, () => {
        resolve(`Fairpost REST Api running on ${host}:${port}`);
      });
    });
  }

  public static async handleRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    logger: log4js.Logger
  ) {
    logger.trace('Server.handleRequest','start',request.url);
    if (request.url === "/favicon.ico") {
      const fileStream = fs.createReadStream("public/fairpost-icon.png");
      response.writeHead(200, { "Content-Type": "image/png" });
      fileStream.pipe(response);
      return;
    }

    const parsed = new URL(
      request.url ?? "/",
      `${request.headers.protocol}://${request.headers.host}`,
    );
    const [username, command] = parsed.pathname?.split("/").slice(1) ?? [
      "",
      "",
    ];
    const userid = username.replace("@", "");
    const dryrun = parsed.searchParams.get("dry-run") === "true";
    const output = parsed.searchParams.get("output") ?? "json";
    const targetuser = parsed.searchParams.get("target-user") || undefined;
    const date = parsed.searchParams.get("date");
    const post = parsed.searchParams.get("post");
    const [source, platform] = post
      ? (post.split(":") as [string, PlatformId])
      : [
          parsed.searchParams.get("source") || undefined,
          (parsed.searchParams.get("platform") as PlatformId) || undefined,
        ];
    const platforms = parsed.searchParams.get("platforms")?.split(",") as
      | PlatformId[]
      | undefined;
    const sources = parsed.searchParams.get("sources")?.split(",");
    const status =
      (parsed.searchParams.get("status") as PostStatus) || undefined;

    const args = {
      dryrun: dryrun || undefined,
      targetuser: targetuser,
      platforms: platforms,
      platform: platform,
      sources: sources,
      source: source,
      date: date ? new Date(date) : undefined,
      status: status,
    };

    let code = 0;
    let result = undefined;
    let report = "";
    let error = false as boolean | unknown;
    try {
      const operator = Server.getOperator(userid, request);
      const user = new User(userid);
      user.set("settings", "UI", "rest");
      ({ result, report } = await CommandHandler.execute(
        operator,
        user,
        command,
        args,
      ));
      code = 200;
      logger.trace('Server.handleRequest','success',request.url);
    } catch (e) {
      logger.error('Server.handleRequest','error',request.url,e);
      code = 500;
      error = e;
      result = {};
      report = "";
    }

    response.setHeader("Content-Type", "application/json");
    response.setHeader("Connection", "close");
    response.writeHead(code);
    response.end(
      JSON.stringify(
        {
          request: {
            user: username,
            command: command,
            arguments: args,
          },
          result: output === "json" ? result : report,
          error:
            error === false
              ? false
              : error instanceof Error
              ? error.message
              : JSON.stringify(error),
        },
        JSONReplacer,
      ),
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static getOperator(userid: string, request: http.IncomingMessage) {
    // TODO: validate userid and get roles from request
    // for now, just assume its the user and has the rights
    return new Operator(userid, ["user"], "api", true);
  }
}
