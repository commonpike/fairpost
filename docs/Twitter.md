# Platform: Twitter

The Twitter platform is using 
https://github.com/PLhery/node-twitter-api-v2

If you only have one user, your user .env is 
the same as your global .env

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
  - redirect url with host/port from your .env (http://localhost:8000/callback)
  - website https://github.com/commonpike/fairpost
- From the Oauth 01 settings
  - generate Api Key and secret
  - save these in your global .env as 
    - `FAIRPOST_TWITTER_OA1_API_KEY`
    - `FAIRPOST_TWITTER_OA1_API_KEY_SECRET`
  - generate access token and secret, make sure it is read and write
  - save these in your global .env as as 
    - `FAIRPOST_TWITTER_OA1_ACCESS_TOKEN`
    - `FAIRPOST_TWITTER_OA1_ACCESS_TOKEN_SECRET`
- From the OAuth 2 settings
  - save `FAIRPOST_TWITTER_CLIENT_ID` in your global .env
  - save `FAIRPOST_TWITTER_CLIENT_SECRET` in your global .env

### Enable the platform
 - Add 'twitter' to your `FAIRPOST_FEED_PLATFORMS` in your users `.env`

### Get an OAuth2 Access Token for your twitter account

This token should last forever (?)

 - call `./fairpost.js setup-platform --platform=twitter`
 - follow instructions from the command line

### Test the platform
 - call `./fairpost.js test-platform --platform=twitter`

## Manage additional feeds with the same app

One fairpost user can only manage one feed. If you create a second user, you can use the same app to manage a different feed. OAuth2 allows you to enable the app for your second account, but the OAuth1 part is tied to your first
account and requires you to specify an 'additional_owner' for the uploaded media.

To get this working, you need to follow instruction at [Set up for multiple users](./docs/MultipleUsers.md)

## Add a second user 
- call `./fairpost.js add-user --user=foo` # todo

### Get an OAuth2 Access Token for your other page

- call `./fairpost.js @foo setup-platform --platform=twitter`
- follow instructions from the command line

### Test the other installation
- call `./fairpost.js @foo test-platform --platform=twitter`

### Set the 'additional owner'
- from the previous `test-platform` result, copy the `oauth2:id`
- set this as the `FAIRPOST_TWITTER_OA1_ADDITIONAL_OWNER` in your users .env

# Random documentation

https://github.com/twitterdev/twitter-api-typescript-sdk/blob/main/src/gen/Client.ts#L889

https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/main/Manage-Tweets/create_tweet.js#L106