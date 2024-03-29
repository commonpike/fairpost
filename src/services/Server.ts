import * as fs from "fs";
import * as http from "http";

import CommandHandler from "./CommandHandler";
import { JSONReplacer } from "../utilities";
import { PlatformId } from "../platforms";
import { PostStatus } from "../models/Post";
import User from "../models/User";

/**
 * ~~~~~: ~~~~~
 */
export default class Server {
  /**
   * starts a webserver on host:port
   */

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
      //response.end();
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
    const date = parsed.searchParams.get("date");
    const post = parsed.searchParams.get("post");
    const [folder, platform] = post
      ? (post.split(":") as [string, PlatformId])
      : [
          parsed.searchParams.get("folder") || undefined,
          (parsed.searchParams.get("platform") as PlatformId) || undefined,
        ];
    const platforms = parsed.searchParams.get("platforms")?.split(",") as
      | PlatformId[]
      | undefined;
    const folders = parsed.searchParams.get("folders")?.split(",");
    const status =
      (parsed.searchParams.get("status") as PostStatus) || undefined;

    const args = {
      dryrun: dryrun || undefined,
      platforms: platforms,
      platform: platform,
      folders: folders,
      folder: folder,
      date: date ? new Date(date) : undefined,
      status: status,
    };

    const { result, report } = await (async () => {
      try {
        const user = new User(username.replace("@", ""));
        return await CommandHandler.execute(user, command, args);
      } catch (e) {
        return {
          result: e,
          report: e instanceof Error ? e.message : String(e),
        };
      }
    })();

    response.setHeader("Content-Type", "application/json");
    response.setHeader("Connection", "close");
    response.writeHead(200);
    response.end(
      JSON.stringify(
        {
          request: {
            user: username,
            command: command,
            arguments: args,
          },
          result: output === "json" ? result : report,
        },
        JSONReplacer,
      ),
    );
  }
}
