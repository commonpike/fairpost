import cookie from "cookie";
import { createReadStream } from "fs";
import { createServer, IncomingMessage, ServerResponse } from "http";

import Fairpost from "./Fairpost.ts";
import AuthService from "./AuthService.ts";
import { JSONReplacer, parsePayload } from "../utilities.ts";
import { PlatformId } from "../platforms/index.ts";
import { SourceStage, PostStatus } from "../types/index.ts";
import Operator from "../models/Operator.ts";
import User from "../models/User.ts";

/**
 * Server: start a webserver for an REST api
 */
export default class Server {
  public static async serve(): Promise<string> {
    process.env.FAIRPOST_UI = "api";
    const host = process.env.FAIRPOST_SERVER_BIND;
    const port = Number(process.env.FAIRPOST_SERVER_PORT);
    return await new Promise((resolve) => {
      const server = createServer((req, res) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        Server.handleRequest(req, res);
      });
      server.listen(port, host, () => {
        resolve(`Fairpost REST Api running on ${host}:${port}`);
      });
    });
  }

  public static async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    // enable CORS
    response.setHeader(
      "Access-Control-Allow-Origin",
      process.env.FAIRPOST_SERVER_CORS ?? "*",
    );
    //response.setHeader("Access-Control-Request-Method", "*");
    response.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
    //response.setHeader("Access-Control-Allow-Headers", "*");
    const requestedHeaders = request.headers['access-control-request-headers'] || 'Content-Type';
    response.setHeader("Access-Control-Allow-Headers", requestedHeaders);
    response.setHeader("Access-Control-Allow-Credentials", "true");

    if (request.method === "OPTIONS") {
      response.writeHead(200);
      response.end();
      return;
    }

    // handle favico
    if (request.url === "/favicon.ico") {
      const fileStream = createReadStream("public/fairpost-icon.png");
      response.writeHead(200, { "Content-Type": "image/png" });
      fileStream.pipe(response);
      return;
    }

    Fairpost.logger.trace("Server.handleRequest", "start", request.url);

    const parsed = new URL(
      request.url?.replace(/\/+/, "/") ?? "/",
      `${request.headers.protocol}://${request.headers.host}`,
    );

    // read userid and command from path
    let username = undefined,
      userid = undefined,
      command = undefined;
    const [part1, part2] = parsed.pathname?.split("/").slice(1) ?? ["", ""];
    if (part1.startsWith("@")) {
      username = part1;
      userid = part1.replace("@", "");
      command = part2;
    } else {
      command = part1;
    }

    // read other params from query
    const password = parsed.searchParams.get("password") || undefined;
    const model = parsed.searchParams.get("model") || undefined;
    const dryrun = parsed.searchParams.get("dry-run") === "true";
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
    const stage =
      (parsed.searchParams.get("stage") as SourceStage) || undefined;

    // read payload from PUT or POST
    let payload = undefined as undefined | Buffer | string | object;
    if (request.method === "POST" || request.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);
      payload = await parsePayload(buffer, request.headers["content-type"]);
    }

    const args = {
      password: password,
      dryrun: dryrun || undefined,
      model: model,
      platforms: platforms,
      platform: platform,
      sources: sources,
      source: source,
      date: date ? new Date(date) : undefined,
      status: status,
      stage: stage,
      payload: payload,
    };

    let code = 0;
    let output = undefined;
    let operatorid = undefined;

    let error = false as boolean | unknown;
    try {
      let user = undefined;
      if (userid !== undefined) {
        user = await User.getUser(userid);
      }
      const operator = await Server.getOperator(request, user);
      operatorid = operator.id;

      output = await Fairpost.execute(operator, user, command, args);
      code = 200;
      Fairpost.logger.trace("Server.handleRequest", "success", request.url);
      if (user !== undefined) {
        await Server.addFairpostSession(response, user, command);
      }
    } catch (e) {
      Fairpost.logger.error("Server.handleRequest", "error", request.url);
      code = 500;
      error = e;
      output = {};
    }

    response.setHeader("Content-Type", "application/json");
    response.setHeader("Connection", "close");
    response.writeHead(code);
    response.end(
      JSON.stringify(
        {
          request: {
            user: username,
            operator: operatorid,
            command: command,
            arguments: args,
          },
          result: output,
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
  public static async getOperator(request: IncomingMessage, user?: User) {
    if (user !== undefined) {
      if (process.env.FAIRPOST_USER_AUTH === "fairpost") {
        const cookies = cookie.parse(request.headers.cookie || "");
        if ("FairpostSession" in cookies) {
          if (
            await AuthService.verifyToken(
              user,
              cookies["FairpostSession"] ?? "",
            )
          ) {
            return new Operator(user.id, ["user"], "api", true);
          }
        }
        return new Operator(user.id, ["anonymous"], "api", false);
      }
    }
    return new Operator("anonymous", ["anonymous"], "api", true);
  }

  public static async addFairpostSession(
    response: ServerResponse,
    user: User,
    command: string,
  ) {
    if (process.env.FAIRPOST_USER_AUTH === "fairpost") {
      const baseCookie = {
        httpOnly: true,
        secure: process.env.FAIRPOST_SESSION_SECURE !== "false",
        sameSite: (process.env.FAIRPOST_SESSION_SAMESITE ?? "strict") as
          | "strict"
          | "lax"
          | "none",
        path: "/",
      };
      if (["login", "refresh-token"].includes(command)) {
        const token = await AuthService.getToken(user);
        response.setHeader(
          "Set-Cookie",
          cookie.serialize("FairpostSession", token, {
            ...baseCookie,
            maxAge: +(process.env.FAIRPOST_SESSION_TIMEOUT ?? 60 * 60),
          }),
        );
      }
      if (command === "logout") {
        response.setHeader(
          "Set-Cookie",
          cookie.serialize("FairpostSession", "", {
            ...baseCookie,
            maxAge: 0,
          }),
        );
      }
    }
  }
}
