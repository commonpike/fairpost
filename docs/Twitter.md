# Platform: Twitter

## Setting up the Twitter platform

### Create a new App in your twitter account

- go to https://developer.twitter.com/
- create a few developer account
- you get a project and an app, rename those
- regenerate Api Key and secret, and store those in .env (?)
- set up User authentication settings
  - read and write
  - fairpost is a bot
  - redirect url http://localhost:8000
  - website https://github.com/commonpike/fairpost
- save FAIRPOST_TWITTER_CLIENT_ID in .env
- save FAIRPOST_TWITTER_CLIENT_SECRET in .env


# Random documentation

https://github.com/twitterdev/twitter-api-typescript-sdk/blob/main/src/gen/Client.ts#L889

https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/main/Manage-Tweets/create_tweet.js#L106