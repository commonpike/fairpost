import User from "./models/User";

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
    } catch (e) {
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
  throw user.error(errorMessage, error.response?.url, errorDetails);
}
