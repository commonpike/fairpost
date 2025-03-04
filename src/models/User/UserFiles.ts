import { resolve } from "path";
import { Readable } from "stream";

import User from "../User.ts";

import {
  FileStorage,
  DirectoryListing,
  FileContents,
  StatEntry,
} from "@flystorage/file-storage";
import { LocalStorageAdapter } from "@flystorage/local-fs";

/**
 * UserFiles is a wrapper around flystorage, tied to a user;
 */

export default class UserFiles {
  private user: User;
  public storage: FileStorage;

  constructor(user: User) {
    this.user = user;
    switch (process.env.FAIRPOST_FILE_SYSTEM) {
      default: {
        const adapter = new LocalStorageAdapter(
          resolve(import.meta.dirname + "/../../../", user.homedir),
        );
        this.storage = new FileStorage(adapter);
      }
    }
  }

  public async init() {
    if (!(await this.storage.directoryExists("."))) {
      throw new Error("No such user: " + this.user.id);
    }
  }

  public async stat(path: string): Promise<StatEntry> {
    return await this.storage.stat(path);
  }

  public async exists(path: string): Promise<boolean> {
    try {
      return !!(await this.storage.stat(path));
    } catch {
      return false;
    }
  }

  public async isDir(path: string): Promise<boolean> {
    try {
      return await this.storage.directoryExists(path);
    } catch {
      return false;
    }
  }
  public async isFile(path: string): Promise<boolean> {
    try {
      return await this.storage.fileExists(path);
    } catch {
      return false;
    }
  }

  public list(path: string): DirectoryListing {
    return this.storage.list(path);
  }
  public async mkdir(path: string): Promise<void> {
    return await this.storage.createDirectory(path);
  }
  public async read(path: string): Promise<Readable> {
    return await this.storage.read(path);
  }
  public async readFile(path: string): Promise<string> {
    return await this.storage.readToString(path);
  }
  public async readBuffer(path: string): Promise<Buffer> {
    return await this.storage.readToBuffer(path);
  }
  public async write(path: string, contents: FileContents): Promise<void> {
    return await this.storage.write(path, contents);
  }
  public async copy(src: string, dst: string): Promise<void> {
    return await this.storage.copyFile(src, dst);
  }

  public async getMimeType(path: string): Promise<string> {
    return await this.storage.mimeType(path);
  }
  public async getSize(path: string): Promise<number> {
    return await this.storage.fileSize(path);
  }
}
