import * as fs from "fs";
import * as http from "http";
import * as url from "url";

class DeferredResponseQuery {
  promise: Promise<{ [key: string]: string | string[] }>;
  reject: Function = () => {}; // eslint-disable-line
  resolve: Function = () => {}; // eslint-disable-line
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}

/**
 * OAuth2Service: Static service to launch a webserver for
 * requesting remote permissions on a service
 */
export default class OAuth2Service {
  public static getRequestUrl(clientHost: string, clientPort: number): string {
    return `http://${clientHost}:${clientPort}`;
  }

  public static getCallbackUrl(clientHost: string, clientPort: number): string {
    return this.getRequestUrl(clientHost, clientPort) + "/callback";
  }

  /**
   * Request remote permissions
   *
   * starts a webserver on host:port, showing a page with
   * serviceLink on it. Keeps the webserver open until the
   * client returns with a code, then stops the server and
   * resolves the query passed.
   * @param serviceName - the name of the remote platform
   * @param serviceLink - the uri to the remote platform
   * @returns a flat object of returned query
   */

  public static async requestRemotePermissions(
    serviceName: string,
    serviceLink: string,
    clientHost: string,
    clientPort: number,
  ): Promise<{ [key: string]: string | string[] }> {
    const server = http.createServer();
    const deferred = new DeferredResponseQuery();

    server.listen(clientPort, clientHost, () => {
      console.log(
        `Open a web browser and go to ${this.getRequestUrl(
          clientHost,
          clientPort,
        )}`,
      );
    });
    const requestListener = async function (
      request: http.IncomingMessage,
      response: http.ServerResponse,
    ) {
      const parsed = url.parse(request.url ?? "/", true);
      if (parsed.pathname === "/callback") {
        let result = "";
        for (const key in parsed.query) {
          result += key + " : " + String(parsed.query[key]) + "\n";
        }
        let body = fs.readFileSync("public/auth/callback.html", "utf8");
        body = body.replace(/{{serviceName}}/g, serviceName);
        body = body.replace(/{{result}}/g, result ?? "UNKNOWN");
        response.setHeader("Content-Type", "text/html");
        response.setHeader("Connection", "close");
        response.writeHead(200);
        response.end(body);
        server.close();
        deferred.resolve(parsed.query);
      } else {
        let body = fs.readFileSync("public/auth/request.html", "utf8");
        body = body.replace(/{{serviceLink}}/g, serviceLink);
        body = body.replace(/{{serviceName}}/g, serviceName);
        response.setHeader("Content-Type", "text/html");
        response.writeHead(200);
        response.end(body);
      }
    };
    server.on("request", requestListener);

    return deferred.promise;
  }
}
