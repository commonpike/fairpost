import argon2 from "argon2";
import { randomBytes } from "crypto";
import User from "../models/User.ts";

/**
 * AuthService handles authentication; wrapping
 * sauth (simple auth) or eg amazon cognito
 * given by FAIRPOST_USER_AUTH
 */

export default class AuthService {
  public static async setPassword(user: User, pass: string) {
    switch (process.env.FAIRPOST_USER_AUTH) {
      default: {
        const crypted = await argon2.hash(pass);
        user.log.info("AuthService", "Setting password ..");
        user.data.set("auth", "FAIRPOST_PASSWORD", crypted);
        user.data.save();
      }
    }
  }

  public static async generateToken(
    user: User,
  ): Promise<{ token: string; timeout: Date }> {
    switch (process.env.FAIRPOST_USER_AUTH) {
      default: {
        const token = randomBytes(32).toString("hex");
        const timeout = new Date();
        timeout.setHours(timeout.getHours() + 1);
        user.data.set("auth", "FAIRPOST_ACCESS_TOKEN", token);
        user.data.set("auth", "FAIRPOST_ACCESS_EXPIRY", timeout.toISOString());
        user.data.save();
        return { token, timeout };
      }
    }
  }

  public static async getToken(user: User): Promise<string> {
    switch (process.env.FAIRPOST_USER_AUTH) {
      default: {
        const timeout = user.data.get("auth", "FAIRPOST_ACCESS_EXPIRY", "");
        if (timeout) {
          if (new Date() < new Date(timeout)) {
            return user.data.get("auth", "FAIRPOST_ACCESS_TOKEN");
          } else {
            AuthService.logout(user);
            throw user.log.error("AuthService", "getToken: token timed out");
          }
        } else {
          throw user.log.error("AuthService", "getToken: no token available");
        }
      }
    }
  }

  public static async login(user: User, pass?: string): Promise<string> {
    switch (process.env.FAIRPOST_USER_AUTH) {
      default: {
        if (pass) {
          const crypted = user.data.get("auth", "FAIRPOST_PASSWORD");
          if (await argon2.verify(crypted, pass)) {
            const result = await AuthService.generateToken(user);
            return result.token;
          } else {
            throw user.log.error("AuthService.login", "Wrong password");
          }
        } else {
          throw user.log.error("AuthService.login", "Missing password");
        }
      }
    }
  }
  public static async verifyToken(user: User, token: string): Promise<boolean> {
    switch (process.env.FAIRPOST_USER_AUTH) {
      default: {
        // masquerading:
        // const authUserId = user.data.get('auth','managed-by',user.id);
        const userToken = await AuthService.getToken(user);
        if (token !== userToken) {
          user.log.error("AuthService", "verifyToken: tokens dont match");
          return false;
        }
        return true;
      }
    }
  }

  public static async logout(user: User) {
    user.data.del("auth", "FAIRPOST_ACCESS_TOKEN");
    user.data.del("auth", "FAIRPOST_ACCESS_EXPIRY");
    user.data.save();
  }
}
