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
 - go to https://developers.facebook.com/
 - create an app that can manage pages 
 - include the "Instagram Graph API" product as a new product 
 - under 'settings', find your app ID 
   - save this as `FAIRPOST_INSTAGRAM_APP_ID` in your .env
 - under 'settings', find your app secret
   - save this as `FAIRPOST_INSTAGRAM_APP_SECRET` in your .env


### Find your instagram user id 
  - go to https://www.instagram.com/web/search/topsearch/?query={username}
  - find your fbid_v2 
  - note the user id 
    - save this as `FAIRPOST_INSTAGRAM_USER_ID` in your .env

### Get a (short lived) Page Access Token for the page related to the instagram account you want the app to manage

This is good for testing, but you'll have to refresh this token often.

 - go to https://developers.facebook.com/tools/explorer/
 - select your app 
 - add permissions
   - pages_manage_engagement
   - pages_manage_posts
   - pages_read_engagement
   - pages_read_user_engagement
   - publish_video
   - business_management
   - instagram_basic
   - instagram_content_publish
 - request a (short lived) page access token
   - save this as `FAIRPOST_INSTAGRAM_PAGE_ACCESS_TOKEN` in your .env

### Get a (long lived) Page Access Token for the page related to the instagram account you want the app to manage

This token should last forever. It involves get a long-lived user token and then requesting the 'accounts' for your 'app scoped user id'; but this app provides a tool to help you do that: 

 - go to https://developers.facebook.com/tools/explorer/
 - select your app 
 - add permissions
   - pages_manage_engagement
   - pages_manage_posts
   - pages_read_engagement
   - pages_read_user_engagement
   - publish_video
   - business_management
   - instagram_basic
   - instagram_content_publish
 - request a (short lived) user access token
 - click 'submit' to submit the default `?me` query
   - remember the `id` in the response as your id
 - call `./fairpost.js facebook-get-page-token
    --app-user-id={your id} --user-token={your token}`
   - note the token returned 
   - save this as `FAIRPOST_INSTAGRAM_PAGE_ACCESS_TOKEN` in your .env

### Enable and test the instagram platform
 - Add 'instagram' to your `FAIRPOST_FEED_PLATFORMS` in `.env`
 - call `./fairpost.js test-platform --platform=instagram`

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
