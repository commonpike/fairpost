# Platform: Twitter

The Twitter platform is using 
https://github.com/PLhery/node-twitter-api-v2

## Setting up the Twitter platform

The Twitter api was being rebuild when Elon Musk
bought it and broke it. Part of it now runs on 
OAuth1, and part of it on Oauth2, and you have 
to configure both. Hopefully, one day, the 'O1'
keys will not be needed anymore.

### Create a new App in your twitter account

- go to https://developer.twitter.com/
- create a few developer account
- you get a project and an app, rename those
- set up User authentication settings
  - read and write
  - fairpost is a bot
  - redirect url with host/port from your .env (http://localhost:8000)
  - website https://github.com/commonpike/fairpost
- From the Oauth 01 settings
  - generate Api Key and secret
  - save these in .env as 
    - `FAIRPOST_TWITTER_O1_API_KEY`
    - `FAIRPOST_TWITTER_O1_API_KEY_SECRET`
  - generate access token and secret, make sure it is read and write
  - save these in .env as as 
    - `FAIRPOST_TWITTER_O1_ACCESS_TOKEN`
    - `FAIRPOST_TWITTER_O1_ACCESS_TOKEN_SECRET`
- From the OAuth 2 settings
  - save `FAIRPOST_TWITTER_CLIENT_ID` in .env
  - save `FAIRPOST_TWITTER_CLIENT_SECRET` in .env

### Enable the platform
 - Add 'twitter' to your `FAIRPOST_FEED_PLATFORMS` in `.env`

### Get an OAuth2 Access Token for your twitter account

This token should last forever (?)

 - call `./fairpost.js setup-platform --platform=twitter`
 - follow instructions from the command line

# Random documentation

https://github.com/twitterdev/twitter-api-typescript-sdk/blob/main/src/gen/Client.ts#L889

https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/main/Manage-Tweets/create_tweet.js#L106