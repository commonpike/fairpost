# Platform: Instagram

The `instagram` platform manage a instagram account 
that is connected to a facebook **page**
using the plain facebook graph api - no extensions installed.

It publishes **photo**, **video**, or 
**carousels** posts on that instagram account.

It uses the related facebook account to
upload temporary files, because the instagram
api requires files in posts to have an url.



## Setting up the Instagram platform


### Create a new App in your facebook account
 - create an Instagram business account
 - connect a Facebook page to your Instagram business account
 - find that pages id and 
   - save this as `FAIRPOST_INSTAGRAM_PAGE_ID` in your users .env
 - go to https://developers.facebook.com/
 - create an app that can manage pages 
 - include the "Instagram Graph API" product as a new product 
 - under 'settings', find your app ID 
   - save this as `FAIRPOST_INSTAGRAM_APP_ID` in your servers .env
 - under 'settings', find your app secret
   - save this as `FAIRPOST_INSTAGRAM_APP_SECRET` in your servers .env


### Find your instagram user id 
  - go to https://www.instagram.com/web/search/topsearch/?query={username}
  - find your fbid_v2 
  - save this as `FAIRPOST_INSTAGRAM_USER_ID` in your users .env

### Enable the platform
 - Add 'instagram' to your `FAIRPOST_FEED_PLATFORMS` in your users env `.env`

### Get a (long lived) Page Access Token for the page you want the app to manage

This token should last forever. It involves getting a user access token,
exchaning it for  a long-lived user token and 
then requesting the 'accounts' for your 'app scoped user id'; 
but this app provides a tool to help you do that.

Requesting access tokens only works 
 - in dev mode and for users that can manage the app
 - or in live mode if the app has advanced access permissions
 
To get advanced access permissions, the app has to go
through a review. Below, I will assume you use dev
mode when requesting the tokens. Once you have the 
tokens, you can turn on Live mode and start posting.


- set your app back in dev mode 
  - go to https://developers.facebook.com/
  - select your app, edit it 
  - set App Mode to 'dev'
- call `./fairpost.js setup-platform --platform=instagram`
- follow instructions from the command line

### Test the  platform
 - call `./fairpost.js test-platform --platform=instagram`

### Set the App to Live Mode
before you use the app, set the App Mode to 'Live'
  - go to https://developers.facebook.com/
  - select your app, edit it 
  - set App Mode to 'live'
  - use https://github.com/commonpike/fairpost/blob/master/public/privacy-policy.md for the privacy policy url

## Manage additional pages with the same app

One fairpost user can only manage one page. If you create a second user, you can use the same app id to manage a different page. The app is registered on your account, so if you can manage the other page, so can the app. 

## Add a second user 
- call `./fairpost.js add-user --user=foo` # todo

### Find your other instagram user id 
  - go to https://www.instagram.com/web/search/topsearch/?query={username}
  - find your fbid_v2 
  - save this as `FAIRPOST_INSTAGRAM_USER_ID` in your users .env

### Enable the app on the other page 
- Go to https://www.facebook.com/settings/?tab=business_tools
- edit the app and check the boxes of the other pages you want to manage.

### Get a access token for the other page

- set your app back in dev mode 
  - go to https://developers.facebook.com/
  - select your app, edit it 
  - set App Mode to 'dev'
- call `./fairpost.js @foo setup-platform --platform=instagram`
- follow instructions from the command line
- put your app back in live mode 

### Test the platform for the other page
 - call `./fairpost.js @foo test-platform --platform=instagram`


# Limitations 

## Images 

- Carousels are limited to 10 images, videos, or a mix of the two.
- Carousel images are all cropped based on the first image in the carousel, with the default being a 1:1 aspect ratio.


### Supported Formats
Instagram supports the following formats:
 - JPEG

### File Size

xxx

# Random documentation

https://developers.facebook.com/docs/instagram-api/guides/content-publishing

- only jpeg
- rate limit w endpoint
- upload media first

POST /{ig-user-id}/media — upload media and create media containers.
POST /{ig-user-id}/media_publish — publish uploaded media using their media containers.
GET /{ig-container-id}?fields=status_code — check media container publishing eligibility and status.
GET /{ig-user-id}/content_publishing_limit — check app user's current publishing rate limit usage.

~~~
GET /{ig-container-id}?fields=status_code endpoint. This endpoint will return one of the following:

EXPIRED — The container was not published within 24 hours and has expired.
ERROR — The container failed to complete the publishing process.
FINISHED — The container and its media object are ready to be published.
IN_PROGRESS — The container is still in the publishing process.
PUBLISHED — The container's media object has been published.
