import User from "./models/User.ts";
import crypto from "crypto";

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function JSONReplacer(key: string, value: any): any {
  if (value instanceof User) {
    return undefined;
  }
  return value;
}
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function isSimilarArray(a: any, b: any) {
  a = Array.isArray(a) ? a : [];
  b = Array.isArray(b) ? b : [];
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  return a.length === b.length && a.every((el: any) => b.includes(el));
}

export async function parsePayload(
  buffer: Buffer,
  type?: string,
): Promise<Buffer | string | object> {
  const str = buffer.toString("utf8");

  const contentType = type?.split(";")[0].trim().toLowerCase();
  if (contentType === "application/json") {
    try {
      return JSON.parse(str);
    } catch {
      return buffer; // invalid JSON, keep raw
    }
  }
  if (contentType && contentType.startsWith("text/")) {
    return str;
  }

  // Heuristic fallback: Try JSON first
  try {
    const trimmed = str.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      return JSON.parse(trimmed);
    }
  } catch {
    // Ignore, not valid JSON
  }

  // Check for binary (NUL bytes or lots of control chars)
  const isBinary = buffer.some((b) => b === 0 || b < 7 || (b > 13 && b < 32));

  if (!isBinary) {
    return str;
  }

  // Otherwise, return raw binary
  return buffer;
}

export class ApiResponseError extends Error {
  response: Response;
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  responseData?: any;
  responseText?: string;
  constructor(response: Response, data?: object | string) {
    super("ApiResponseError: " + response.status + " " + response.statusText);
    this.response = response;
    if (data && typeof data === "object") {
      this.responseData = data;
    }
    if (data && typeof data === "string") {
      this.responseText = data;
    }
  }
}

export async function handleApiResponse(response: Response): Promise<Blob> {
  return await handleBlobResponse(response);
}

export async function handleEmptyResponse(
  response: Response,
  includeHeaders = false,
): Promise<object> {
  const data = {} as { headers: { [key: string]: string } };
  if (includeHeaders) {
    data["headers"] = {};
    for (const [name, value] of response.headers) {
      data["headers"][name] = value;
    }
  }
  if (!response.ok) {
    // network error in the 3xx–5xx range
    throw new ApiResponseError(response, data);
  }
  return data;
}

export async function handleJsonResponse(
  response: Response,
  includeHeaders = false,
): Promise<object> {
  if (!response.ok) {
    // network error in the 3xx–5xx range
    try {
      const data = await response.json(); // may throw a syntaxerror
      throw new ApiResponseError(response, data);
    } catch {
      throw new ApiResponseError(response);
    }
  }
  const data = await response.json(); // may throw a syntaxerror
  if (includeHeaders) {
    data["headers"] = {};
    for (const [name, value] of response.headers) {
      data["headers"][name] = value;
    }
  }

  return data;
}

export async function handleTextResponse(response: Response): Promise<string> {
  const data = await response.text();
  if (!response.ok) {
    // network error in the 3xx–5xx range
    throw new ApiResponseError(response, data);
  }
  return data;
}

export async function handleBlobResponse(response: Response): Promise<Blob> {
  if (!response.ok) {
    // network error in the 3xx–5xx range
    throw new ApiResponseError(response);
  }
  return await response.blob();
}

export async function handleArrayBufferResponse(
  response: Response,
): Promise<ArrayBuffer> {
  if (!response.ok) {
    // network error in the 3xx–5xx range
    throw new ApiResponseError(response);
  }
  return await response.arrayBuffer();
}

export async function handleFormResponse(
  response: Response,
  includeHeaders = false,
): Promise<object> {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  const data = Object.fromEntries(await response.formData()) as any;
  if (includeHeaders) {
    data["headers"] = {};
    for (const [name, value] of response.headers) {
      data["headers"][name] = value;
    }
  }
  if (!response.ok) {
    // network error in the 3xx–5xx range
    throw new ApiResponseError(response, data);
  }
  return data;
}

export async function handleApiError(
  error: ApiResponseError,
  user?: User,
): Promise<never> {
  if (!user) {
    throw error;
  }
  let errorMessage = error.message;

  const errorDetails = {} as { [key: string]: string | number | object };

  // details added by ApiResponseError
  if (error.response) {
    errorDetails["status"] = error.response.status;
    errorDetails["statusText"] = error.response.statusText;
    errorDetails["url"] = error.response.url;
  }
  if (error.responseData) {
    errorDetails["data"] = JSON.stringify(error.responseData);
  }
  if (error.responseText) {
    errorDetails["text"] = error.responseText;
  }

  // errors thrown by fetch
  // https://github.com/node-fetch/node-fetch/blob/main/docs/ERROR-HANDLING.md
  if (error.name === "AbortError") {
    errorDetails["name"] = "AbortError";
    errorMessage += ": The request was Aborted";
  }

  if (error instanceof SyntaxError) {
    // response.json() Unexpected token < in JSON
    errorDetails["name"] = "SyntaxError";
    errorMessage += ": There was a SyntaxError in the response";
  }

  if (error.name === "FetchError") {
    // codes added by node
    errorDetails["name"] = "FetchError";
    if ("type" in error) {
      errorDetails["type"] = error.type as number;
    }
    if ("code" in error) {
      errorDetails["code"] = error.code as number;
    }
    if ("errno" in error) {
      errorDetails["errno"] = error.errno as number;
    }
  }
  throw user.log.error(errorMessage, error.response?.url, errorDetails);
}

export async function encryptAESWeb(text: string, secret: string) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: iv,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text),
  );
  // Combine iv and encrypted data
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  return Buffer.from(result).toString("base64");
}

export async function decryptAESWeb(encryptedBase64: string, secret: string) {
  const enc = new TextEncoder();
  const data = Buffer.from(encryptedBase64, "base64");
  const iv = data.subarray(0, 12);
  const encrypted = data.subarray(12);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: iv,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted,
  );
  return new TextDecoder().decode(decrypted);
}
