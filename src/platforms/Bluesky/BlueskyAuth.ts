import { BskyAgent } from "@atproto/api";
import User from "../../models/User.ts";
import * as readline from "node:readline/promises";

export default class BlueskyAuth {
  service = "https://bsky.social";
  agent?: BskyAgent;
  user: User;

  constructor(user: User) {
    this.user = user;
  }

  /**
   * Set up Bluesky platform
   *
   * In 2025, this uses a service, user handle, app password
   */

  public async setupCli() {
    const reader = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const tokens = {
      identifier: "",
      password: "",
    };
    tokens.identifier = await reader.question(
      `BlueSky account ( like foobar.bsky.social ):`,
    );
    console.log(
      "To let Fairpost post on your behalf, Bluesky requires an App Password.",
    );
    console.log("We will never ask for your main password.");
    console.log("You can create an app password here:");
    console.log("https://bsky.app/settings/app-passwords");
    tokens.password = await reader.question(`BlueSky app password`);
    reader.close();
    await this.store(tokens);
    console.log("Credentials stored.");
  }

  public async setupApi() {
    throw this.user.log.error("BlueskyAuth:setupApi - not implemented");
  }

  /**
   * Save all tokens in auth store
   * @param tokens - the tokens to store
   */

  private async store(tokens: { identifier: string; password: string }) {
    this.user.data.set("auth", "BLUESKY_IDENTIFIER", tokens["identifier"]);
    this.user.data.set("auth", "BLUESKY_PASSWORD", tokens["password"]);
    await this.user.data.save();
  }

  /**
   * Get or create a BlueSky agent
   * @returns - Agent
   */
  public async getAgent(): Promise<BskyAgent> {
    if (this.agent) {
      return this.agent;
    }
    this.agent = new BskyAgent({
      service: this.service,
    });
    /*
      dd 202507, we *could* store the jwt session to user data
      and load it back into the agent; but if it expires,
      we need to refresh it using the password anyway.
      so lets just store the password and log in every time
    */
    try {
      await this.agent.login({
        identifier: this.user.data.get("auth", "BLUESKY_IDENTIFIER"),
        password: this.user.data.get("auth", "BLUESKY_PASSWORD"),
      });

      console.log("Successfully authenticated!");
      return this.agent;
    } catch (error) {
      console.error("Authentication failed:", error);
      // error: 'AuthenticationRequired',
      // headers: ...
      // success: false
      // status: 401
      throw error;
    }
  }
}
