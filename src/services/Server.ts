import * as fs from "fs";
import * as http from "http";

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
    const user = new User("admin");
    const host = user.get("settings", "SERVER_HOSTNAME");
    const port = Number(user.get("settings", "SERVER_PORT"));

    return await new Promise((resolve) => {
      const server = http.createServer();
      server.listen(port, host, () => {
        resolve(`Fairpost REST Api running on ${host}:${port}`);
      });
      server.on("request", Server.handleRequest);
    });
  }

  public static async handleRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ) {
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
    const dryrun = parsed.searchParams.get("dry-run") === "true";
    const output = parsed.searchParams.get("output") ?? "json";
    const userid = parsed.searchParams.get("userid") || undefined;
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
      userid: userid,
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
      const operator = Server.getOperator(request);
      const user = new User(username.replace("@", ""));
      user.set("settings", "UI", "rest");
      ({ result, report } = await CommandHandler.execute(
        operator,
        user,
        command,
        args,
      ));
      code = 200;
    } catch (e) {
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
          error: !error
            ? false
            : error instanceof Error
            ? error.message
            : String(error),
        },
        JSONReplacer,
      ),
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static getOperator(request: http.IncomingMessage) {
    // TODO: get auth and id from request
    return new Operator(["admin"], "admin", "api", true);
  }
}
