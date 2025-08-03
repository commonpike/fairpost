import { basename, extname, resolve } from "path";
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

  public list(path: string, options?: { deep?: boolean }): DirectoryListing {
    return this.storage.list(path, options);
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
  public async copy(
    src: string,
    dst: string,
    checkForDir = true,
  ): Promise<void> {
    if (checkForDir && (await this.isDir(src))) {
      await this.copyDir(src, dst);
      return;
    }
    return await this.storage.copyFile(src, dst);
  }

  public async copyDir(
    sourceDir: string,
    destinationDir: string,
  ): Promise<string[]> {
    const log: string[] = [];
    const createDirectoryPromises = [];
    for await (const entry of this.list(sourceDir, { deep: true })) {
      if (entry.type === "directory" || entry.isDirectory) {
        const sourcePath = entry.path;
        const relativePath = sourcePath
          .slice(sourceDir.length)
          .replace(/^\/+/, "");
        const destinationPath = `${destinationDir}/${relativePath}`;
        log.push("creating dir " + destinationPath);
        createDirectoryPromises.push(this.mkdir(destinationPath));
      }
    }
    await Promise.all(createDirectoryPromises);

    const copyFilePromises = [];
    for await (const entry of this.list(sourceDir, { deep: true })) {
      if (entry.type === "file" || entry.isFile) {
        const sourcePath = entry.path;
        const relativePath = sourcePath
          .slice(sourceDir.length)
          .replace(/^\/+/, "");
        const destinationPath = `${destinationDir}/${relativePath}`;
        log.push("copying file " + entry.path + " -> " + destinationPath);
        copyFilePromises.push(this.copy(entry.path, destinationPath, true));
      }
    }
    await Promise.all(copyFilePromises);

    return log;
  }

  public async move(
    src: string,
    dst: string,
    checkForDir = true,
  ): Promise<void> {
    if (checkForDir && (await this.isDir(src))) {
      await this.moveDir(src, dst);
      return;
    }
    return await this.storage.moveFile(src, dst);
  }

  public async moveDir(
    sourceDir: string,
    destinationDir: string,
  ): Promise<string[]> {
    const log: string[] = [];

    const createDirectoryPromises = [];
    for await (const item of this.list(sourceDir, { deep: true })) {
      if (item.isDirectory) {
        const relativePath = item.path
          .slice(sourceDir.length)
          .replace(/^\/+/, "");
        const destinationPath = `${destinationDir}/${relativePath}`;
        log.push("creating dir " + destinationPath);
        createDirectoryPromises.push(
          this.storage.createDirectory(destinationPath),
        );
      }
    }
    await Promise.all(createDirectoryPromises);

    const moveFilePromises = [];
    for await (const item of this.list(sourceDir, { deep: true })) {
      if (item.isFile) {
        const relativePath = item.path
          .slice(sourceDir.length)
          .replace(/^\/+/, "");
        const destinationPath = `${destinationDir}/${relativePath}`;
        log.push("moving file " + item.path + "," + destinationPath);
        moveFilePromises.push(this.move(item.path, destinationPath, true));
      }
    }
    await Promise.all(moveFilePromises);

    log.push("deleting dir " + sourceDir);
    await this.storage.deleteDirectory(sourceDir);
    return log;
  }

  public async getMimeType(path: string): Promise<string> {
    try {
      return await this.storage.mimeType(path);
    } catch {
      return "application/unknown";
    }
  }
  public async getSize(path: string): Promise<number> {
    return await this.storage.fileSize(path);
  }
  public async getTimestamp(path: string): Promise<number> {
    return await this.storage.lastModified(path);
  }

  public slugify(name: string) {
    const ext = extname(name).toLowerCase();
    const base = basename(name, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    return base + ext;
  }
}
