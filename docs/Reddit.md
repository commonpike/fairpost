# Platform: Reddit

## Setting up the Reddit platform

### Create a new App in your Reddit account

- go to https://www.reddit.com/prefs/apps
- create an app ('script')
- note the code and secret in your app box
  - save as `FAIRPOST_REDDIT_CLIENT_ID` in .env
  - save as `FAIRPOST_REDDIT_CLIENT_SECRET` in .env
- read the terms here https://www.reddit.com/wiki/api/#wiki_read_the_full_api_terms_and_sign_up_for_usage
- request access to the API using the request form, and wait until approved

### Enable the platform
 - Add 'reddit' to your `FAIRPOST_FEED_PLATFORMS` in `.env`

### Get an OAuth2 Access Token for your Reddit account

This token last for 24 hours and should be refreshed.

 - call `./fairpost.js setup-platform --platform=reddit`
 - follow instructions from the command line

# Random documentation

https://www.reddit.com/prefs/apps

https://www.reddit.com/wiki/api/#wiki_read_the_full_api_terms_and_sign_up_for_usage

duration permanent -> refresh
scope submit

https://github.com/reddit-archive/reddit/wiki/OAuth2

GET https://www.reddit.com/api/v1/authorize?client_id=CLIENT_ID&response_type=TYPE&
    state=RANDOM_STRING&redirect_uri=URI&duration=DURATION&scope=SCOPE_STRING

POST https://www.reddit.com/api/v1/access_token
    grant_type=authorization_code&code=CODE&redirect_uri=URI
    Authorization: Basic Auth (client_id:client_secret)
{
    "access_token": Your access token,
    "token_type": "bearer",
    "expires_in": Unix Epoch Seconds,
    "scope": A scope string,
    "refresh_token": Your refresh token
}

POST https://www.reddit.com/api/v1/access_token
    grant_type=refresh_token&refresh_token=TOKEN
    Authorization: Basic Auth (client_id:client_secret)


https://www.reddit.com/dev/api

https://www.reddit.com/dev/api/oauth#POST_api_submit


~~ https://github.com/reddit-archive/reddit/wiki/OAuth2

https://www.reddit.com/r/redditdev/comments/9li6le/reddit_api_how_do_i_authenticate_trying_to_do/


https://www.reddit.com/r/redditdev/comments/x53h1y/having_trouble_submitting_an_image_post/

https://github.com/rvelasq/scriptable-selig

https://github.com/rvelasq/scriptable-selig/blob/master/Selig.js#L855