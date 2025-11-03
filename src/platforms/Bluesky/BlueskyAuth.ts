import { BskyAgent } from "@atproto/api";
import User from "../../models/User.ts";
import { encryptAESWeb, decryptAESWeb } from "../../utilities.ts";
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

  public async connectCli() {
    const reader = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const tokens = {
      password: "",
    };
    const currentid = this.user.data.get("settings", "BLUESKY_IDENTIFIER", "");
    if (!currentid) {
      throw this.user.log.error(
        "BlueskyAuth:connectCli - set identifier first",
      );
    }
    tokens.password = await reader.question(`BlueSky app password: `);
    reader.close();
    await this.store(tokens);
    console.log("Credentials stored.");
  }

  public async connectApi(payload: { password?: string }) {
    const currentid = this.user.data.get("settings", "BLUESKY_IDENTIFIER", "");
    if (!currentid) {
      throw this.user.log.error(
        "BlueskyAuth:connectApi - set identifier first",
      );
    }
    if (!payload.password) {
      throw this.user.log.error(
        "BlueskyAuth:connectApi - app password missing",
      );
    }
    await this.store({
      password: payload.password,
    });
  }

  /**
   * Save all tokens in auth store
   * @param tokens - the tokens to store
   */

  private async store(tokens: { password: string }) {
    const secret = this.user.data.get("app", "BLUESKY_CRYPT_SECRET");
    const encryptedPassword = await encryptAESWeb(tokens["password"], secret);
    this.user.data.set("auth", "BLUESKY_PASSWORD", encryptedPassword);
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
    const identifier = this.user.data.get("settings", "BLUESKY_IDENTIFIER");
    const encryptedPassword = this.user.data.get("auth", "BLUESKY_PASSWORD");
    const secret = this.user.data.get("app", "BLUESKY_CRYPT_SECRET");
    const password = await decryptAESWeb(encryptedPassword, secret);
    try {
      await this.agent.login({ identifier, password });
      this.user.log.trace("BlueskyAuth", "authenticated");
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
