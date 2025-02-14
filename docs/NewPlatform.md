# How to add a new platform

If your platform is not yet supported by Fairpost,
you can write your own code to support it.

The hardest part is possibly registering your 
instance of the app with the platform, to allow
it to post on your (or your users) behalf. How
that works depends on the platform; ymmv.

## Minimal setup

To add support for a new platform, add a class to `src/platforms`
extending `src/classes/Platform`. You want to override at least the
method `preparePost(source)` and  `publishPost(post,dryrun)`.

Make sure not to throw errors in or below publishPost; instead, just 
return false and let the `Post.processResult()` itself.

```php
<?php

import { PlatformId } from "..";
import User from "../models/User";
import Post from "../models/Post";

export default class FooBar extends Platform {

    assetsFolder = "_foobar";
    postFileName = "post.json";
    
    constructor(user: User) {
      super(user);
    }
    
    /** @inheritdoc */
    async preparePost(source: Source): Promise<Post> {
        const post = await super.preparePost(source);
        if (post) {
            // prepare your post here
            post.save();
        }
        return post;
    }

    /** @inheritdoc */
    async publishPost(post: Post, dryrun: boolean = false): Promise<boolean> {

        let response = { id: "-99" } as { id: string };
        let error = undefined as Error | undefined;

        try {
            response = await this.publishFooBarPost(post, dryrun);
        } catch (e) {
            error = e as Error;
        }

        return post.processResult(
            response.id,
            "https://url-to-your-post",
            {
                date: new Date(),
                dryrun: dryrun,
                success: !error,
                response: response,
                error: error,
            },
        );
    }

    async publishFooBarPost(post: Post, dryrun: boolean = false): object {
        return {
            id: "-99",
            error: "not implemented"
        }
    }
}

```

Then in `src/platforms/index.ts`
- import your class
- add `PlatformId.FOOBAR` for your platform [^1]

Then in your users `storage.json`, enable your platformId
```
PLATFORMS=foobar,..,..
```

check if it works:
```
npm run lint:fix # optional
npm run build
./fairpost.js get-platforms
```

and party.

### Add more methods

#### FooBar.test()

This method allows you to call `fairpost.js test-platform --platform=foobar`. 
You can return anything.

#### FooBar.setup()

This method allows you to call `fairpost.js setup-platform --platform=foobar`, 
usually to get the access tokens and save them in Storage.

#### FooBar.refresh()

This method allows you to call `fairpost.js refresh-platform --platform=foobar`, 
usually to refresh the access tokens and save them in Storage.

### Using User.get() and User.set()

Your platform is constructed with a User, `FooBar.user`.
All configuration, including 'global' configuration from 
Fairpost, is set on (and some can be overridden by) the user. 
The user has three stores, `app`, `settings` and `auth`. Depending on the 
users configuration, these may be stored in different places. If a 
storage uses `.env`, it is read-only.

```php
<?php
    ...
    this.user.set('auth', 'foo', 'bar');
    console.log(this.user.get('auth', 'foo')); // bar
```
### Using User.trace(), User.info(), User.error() etc.

The user contains wrapper methods around log4js. It is configured 
in your `.env` and in `log4js.json`. The `error()` method is exceptional 
in that it not only logs the error, but also returns an error object 
for you to throw:

```php
<?php

    ...
    this.user.trace('foo', 'bar', 'quz');
    throw this.user.error('foo', 'bar', 'quz');
```

### Using Plugins to prepare your Post

Inside `preparePost`, you can call plugins to, for example,
limit the files to a certain type or scale down images, etcetera.
See [Plugins](Plugins.md) for a more detailed description.
If you want users to be able to finetune the plugin settings,
or even enable additional plugins, read the plugin ids and/or
settings using `User.get(...)`.

### Add input/output for custom settings in your platform

If you want custom settings for your platform to be returned 
from, and set by, the various interfaces, add a `settings: FieldMapping`
property to your class describing those settings and in your
constructor, call `this.mapper = new PlatformMapper(this);`.
The mapper will handle the Dto's generated for your platform
using the `settings` you defined.

## A more elaborate setup

As your platform gets bigger, you may want to chunk it
up in several classes. Create a folder `src/platforms/FooBar`,
move your class there, and update the imports.

### FooBarApi.ts

If you're using your own api calls, a simple approach to 
refactor is to take these API calls out of your platform 
into a separate `FooBar/FooBarApi.ts`.

There are some utilities to help you with your Api 
responses and errors. The below code will unpack a json 
response and graciously handle errors:

```php
<?php

import {
  ApiResponseError,
  handleApiError,
  handleJsonResponse,
} from "../../utilities";

...

  public async get(): Promise<object> {

    return await fetch(url, {
      method: "GET",
      headers: {
        Bla: 'Bla'
      },
    })
    .then((res) => handleJsonResponse(res))
    .catch((err) => this.handleFooBarError(err))
    .catch((err) => handleApiError(err,this.user));

...

  private async handleFooBarError(error: ApiResponseError): Promise<never> {
    error.message += '; FooBar made a booboo'
    throw error;
  }

```

### FooBarAuth.ts


Another good approach to refactor is to take the Authentication 
flow out of your platform into a separate `FooBar/FooBarAuth.ts`.
Add a method `setup()` and link your `Foobar.setup()` there.
Optionally add a method `refresh()` and link your `Foobar.refresh()` there.
Store the access tokens in `auth` Storage, so you can access them
in your platform class.

There is a service to help you with the OAuth flow. It starts a web server 
and presents you with a link to click, and processes the response:

```php
<?php

import OAuth2Service from "../../services/OAuth2Service";
import Logger from "../../services/Logger";
import User from "../../models/User";

export default class FooBarAuth {

  user: User;

  constructor(user: User) {
    this.user = user;
  }
  /**
   * Set up FooBar platform
   */
  async setup() {
    const code = await this.requestCode();
    const tokens = await this.exchangeCode(code);
    this.store(tokens);
  }
  ...
  /**
   * Request remote code using OAuth2Service
   * @returns - code
   */
  private async requestCode(): Promise<string> {
    const clientId = this.user.get("settings", "FOOBAR_CLIENT_ID");
     const clientHost = this.user.get("settings", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.get("settings", "OAUTH_PORT"));
    const state = String(Math.random()).substring(2);

    // create auth url
    const url = new URL("https://foobar.com");
    url.pathname = "bla/auth";
    const query = {
      client_id: clientId,
      redirect_uri: OAuth2Service.getCallbackUrl(clientHost,clientPort),
      state: state,
      response_type: "code",
      scope: [
        "foo",
        "bar"
      ].join(" "),
    };
    url.search = new URLSearchParams(query).toString();

    const result = await OAuth2Service.requestRemotePermissions(
      "FooBar",
      url.href,
      clientHost,
      clientPort
    );
    if (result["error"]) {
      const msg = result["error_reason"] + " - " + result["error_description"];
      throw Logger.error(msg, result);
    }
    if (result["state"] !== state) {
      const msg = "Response state does not match request state";
      throw Logger.error(msg, result);
    }
    if (!result["code"]) {
      const msg = "Remote response did not return a code";
      throw Logger.error(msg, result);
    }
    return result["code"] as string;
  }
  /**
   * Exchange remote code for tokens
   * @param code - the code to exchange
   * @returns - TokenResponse
   */
  private async exchangeCode(code: string) {
    const clientHost = this.user.get("settings", "OAUTH_HOSTNAME");
    const clientPort = Number(this.user.get("settings", "OAUTH_PORT"));
    const redirectUri = OAuth2Service.getCallbackUrl(clientHost,clientPort);
    // implement your own post method ... 
    const tokens = (await this.post("token", {
      grant_type: "authorization_code",
      code: code,
      client_id: this.user.get("settings", "FOOBAR_CLIENT_ID"),
      client_secret: this.user.get("settings", "FOOBAR_CLIENT_SECRET"),
      redirect_uri: redirectUri,
    }));
    if (!('accessToken' in tokens)) {
      throw Logger.error("Invalid TokenResponse", tokens);
    }

    return tokens;
  }

  /**
   * Save all tokens in auth store
   * @param tokens - the tokens to store
   */
  private store(tokens) {
    this.user.set("auth", "FOOBAR_ACCESS_TOKEN", tokens["access_token"]);
  }

}

```

[^1]: By default, the platform id is the classname to lowercase. You can override this implementing a static method `id()` that returns another value.