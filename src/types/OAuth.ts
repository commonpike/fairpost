/**
 * The OAuthRequest and OAuthResponse types
 * wrap the OAuth process. The server only serves
 * as a OAuth broker / token-exchange gateway and has no state here;
 * the client connects all the dots.
 *
 * There are several steps in the oauth process, but
 * all steps can now carry an OAuthRequest and will
 * receive an OAuthResponse in return. The "phase"
 * tells you what step you are in.
 *
 * I'm not using 'device' mode at all; but I wanted all
 * flows in here to get the interfaces correct :-)
 *
 * In Phase "Start",
 * - the client has optionally generated a state
 * - it passes the redirect_uri for the third party
 * - the response returns a request_uri for the client to follow
 *
 * In Phase "Polling" (device)
 * - the client keeps sending those requests until it
 *   receives a single "finish" response
 *
 * In Phase "Finish"
 * - the client has optionally checked the state
 * - the client has received a code (basic,pkce) or
 *   a token (implicit), or the server received the tokens (device)
 * - the server exchanges the code and request uri for tokens (basic,pkce)
 * - the server stores these
 * - the server returns success or failure
 *
 */

type OAuthRequestStart =
  | {
      phase: "start";
      flow: "implicit";
      redirect_uri: string;
      state?: string;
    }
  | {
      phase: "start";
      flow: "basic";
      redirect_uri: string;
      state?: string;
    }
  | {
      phase: "start";
      flow: "pkce";
      redirect_uri: string;
      state?: string;
      code_challenge: string;
      code_challenge_method: "S256";
    }
  | {
      phase: "start";
      flow: "device";
      client_id: string;
      scope?: string;
    };

type OAuthResponseStart =
  | {
      phase: "start";
      flow: "implicit";
      request_uri: string;
    }
  | {
      phase: "start";
      flow: "basic";
      request_uri: string;
    }
  | {
      phase: "start";
      flow: "pkce";
      request_uri: string;
    }
  | {
      phase: "start";
      flow: "device";
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    };

type OAuthRequestPolling = {
  phase: "polling";
  flow: "device";
  device_code: string;
  poll_attempt?: number;
  interval_hint_ms?: number;
};

type OAuthResponsePolling = {
  phase: "polling";
  flow: "device";
  error: "authorization_pending" | "slow_down";
};

type OAuthRequestFinish =
  | {
      phase: "finish";
      flow: "implicit";
      redirect_uri: string;
      access_token: string;
      token_type: "Bearer";
      expires_in?: number;
    }
  | {
      phase: "finish";
      flow: "basic";
      redirect_uri: string;
      code: string;
      error: undefined; // discriminate on error !== undefined
    }
  | {
      phase: "finish";
      flow: "basic";
      error: string;
      error_uri?: string;
      error_description?: string;
    }
  | {
      phase: "finish";
      flow: "pkce";
      redirect_uri: string;
      code: string;
      code_verifier: string;
      error: undefined; // discriminate on error !== undefined
    }
  | {
      phase: "finish";
      flow: "pkce";
      error: string;
      error_uri?: string;
      error_description?: string;
    };

type OAuthResponseFinish =
  | {
      phase: "finish";
      flow: "implicit" | "basic" | "pkce" | "device";
      authenticated: true;
      results?: unknown;
      error?: never;
    }
  | {
      phase: "finish";
      flow: "basic" | "pkce";
      authenticated: false;
      error?: string;
    }
  | {
      phase: "finish";
      flow: "device";
      authenticated?: never;
      error: "access_denied" | "expired_token";
    };

export type OAuthRequest =
  | OAuthRequestStart
  | OAuthRequestPolling
  | OAuthRequestFinish;
export type OAuthResponse =
  | OAuthResponseStart
  | OAuthResponsePolling
  | OAuthResponseFinish;
