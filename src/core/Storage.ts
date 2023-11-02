/**
 * Store - minimalist storage manager
 *
 * - sets and gets key / value pairs.
 * - uses two 'stores':
 *   - 'settings' is typically what a user maintains,
 *   - 'auth' is what fairpost maintains and may be
 *     stored and encrypted somewhere else
 *
 */
export default class Storage {
  public static get(
    store: "settings" | "auth",
    key: string,
    def?: string,
  ): string {
    let value = "" as string;
    const storage =
      store === "settings"
        ? process.env.FAIRPOST_STORAGE_SETTINGS
        : process.env.FAIRPOST_STORAGE_AUTH;
    if (storage === "env") {
      value = process.env["FAIRPOST_" + key] ?? "";
    } else {
      throw new Error("Storage " + storage + " not implemented");
    }
    if (!value) {
      if (!def) {
        throw new Error("Value " + key + " not found in store " + store);
      }
      value = def;
    }
    return value;
  }

  public static set(store: "settings" | "auth", key: string, value: string) {
    const storage =
      store === "settings"
        ? process.env.FAIRPOST_STORAGE_SETTINGS
        : process.env.FAIRPOST_STORAGE_AUTH;
    const ui = process.env.FAIRPOST_UI;
    if (storage === "env") {
      if (ui === "cli") {
        console.log("Store this value in your .env file:");
        console.log("FAIRPOST_" + key + "=" + value);
      } else {
        throw new Error("UI " + ui + " not implemented");
      }
    } else {
      throw new Error("Storage " + storage + " not implemented");
    }
  }
}
