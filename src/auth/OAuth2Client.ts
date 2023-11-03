import * as fs from "fs";
import * as http from "http";
import * as url from "url";
import Storage from "../core/Storage";

class DeferredResponseQuery {
  promise: Promise<{ [key: string]: string | string[] }>;
  reject: Function; // eslint-disable-line
  resolve: Function; // eslint-disable-line
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}

/**
 * OAuth2Client: abstract handler to launch a webserver for
 * requesting remote permissions on a service
 */
export default class OAuth2Client {
  protected getClientUrl(): string {
    const clientHost = Storage.get("settings", "CLIENT_HOSTNAME");
    const clientPort = Number(Storage.get("settings", "CLIENT_PORT"));
    return `http://${clientHost}:${clientPort}`;
  }

  protected getRedirectUri(): string {
    return this.getClientUrl() + "/return";
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
   * @param clientHost - the host name to serve the local page on
   * @param clientPort - the port to serve the local page on
   * @returns a flat object of returned query
   */

  protected async requestRemotePermissions(
    serviceName: string,
    serviceLink: string,
  ): Promise<{ [key: string]: string | string[] }> {
    const clientHost = Storage.get("settings", "CLIENT_HOSTNAME");
    const clientPort = Number(Storage.get("settings", "CLIENT_PORT"));
    const server = http.createServer();
    const deferred = new DeferredResponseQuery();

    server.listen(clientPort, clientHost, () => {
      console.log(`Open a web browser and go to ${this.getClientUrl()}`);
    });
    const requestListener = async function (
      request: http.IncomingMessage,
      response: http.ServerResponse,
    ) {
      const parsed = url.parse(request.url ?? "/", true);
      if (parsed.pathname === "/return") {
        let result = "";
        for (const key in parsed.query) {
          result += key + " : " + String(parsed.query[key]) + "\n";
        }
        let body = fs.readFileSync("public/auth/return.html", "utf8");
        body = body.replace(/{{serviceName}}/g, serviceName);
        body = body.replace(/{{result}}/g, result ?? "UNKNOWN");
        response.setHeader("Content-Type", "text/html");
        response.setHeader("Connection", "close");
        response.writeHead(200);
        response.end(body);
        server.close();
        deferred.resolve(parsed.query);
      } else {
        let body = fs.readFileSync("public/auth/index.html", "utf8");
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
