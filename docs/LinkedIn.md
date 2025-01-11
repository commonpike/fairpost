# Platform: LinkedIn

The LinkedIn platform posts to your companies feed.

## Set up the platform

### Create a new App in your linkedin account
- create an company your account can manage
- find your company id (in the url, like , 93841222)
  - save this as `LINKEDIN_COMPANY_ID` in your users storage.json
- create an app to manage the company page \
https://www.linkedin.com/developers/apps/new
- add 'share on linkedin' product on your app
- add 'advertising api' product to the app
  - this requires a lengthy application form - wait for approval
- on the 'settings' tab of your app
  - click the 'verify' button next to the page you want the app to manage \
    and follow instructions there
- on the 'auth' tab of your app
  - copy ClientID and ClientSecret \
    and save those as `FAIRPOST_LINKEDIN_CLIENT_ID` and `FAIRPOST_LINKEDIN_CLIENT_SECRET` \
    in your global `.env`
  - add redirect url for your app as set in your .env (http://localhost:8000/callback)

## Connect the platform to a user

### Enable the platform
 - Add 'linkedin' to your `FEED_PLATFORMS` in your users `storage.json`

### Get an OAuth2 Access Token for your platform

This token last for 60 days and should be refreshed.
The refresh token (if given) lasts for 1 year.

 - call `./fairpost.js @userid setup-platform --platform=linkedin`
 - follow instructions from the command line

### Test the platform
 - call `./fairpost.js @userid test-platform --platform=linkedin`

## Connect the platform to another user

One fairpost user can only manage one page. If you create a second user, you can use the same app id to manage a different page. The app is registered on your account, so if you can manage the other page, so can the app. 

### Create a new user 
- call `./fairpost.js create-user --userid=foo` 
- add linkedin to its FAIRPOST_PLATFORMS
- find your company id (in the url, like , 93841222)
  - save this as `LINKEDIN_COMPANY_ID` in your users storage.json

### Get an OAuth2 Access Token for your other page

 - call `./fairpost.js @foo setup-platform --platform=linkedin`
 - follow instructions from the command line

### Test the other installation
 - call `./fairpost.js @foo test-platform --platform=linkedin`

## More user settings 

 - `LINKEDIN_PLUGIN_SETTINGS` - a json object describing / overwriting the plugins used to prepare posts

# Limitations 

## Images 

...

### Supported Formats

...

### File Size

xxx

## video

https://www.linkedin.com/help/linkedin/answer/a548372

- Maximum file size: 5GB
- Minimum file size: 75KB
- Maximum video duration: 15 minutes when uploading from desktop and 10 minutes when uploading from the LinkedIn mobile app.
- Minimum video duration: 3 seconds
- Resolution range: 256x144 to 4096x2304
- Aspect ratio: 1:2.4 - 2.4:1
- Frame rates: 10fps - 60 fps
- Bit rates: 192 kbps - 30 Mbps

# Random documentation

## access token 
https://www.linkedin.com/advice/1/how-do-you-use-refresh-tokens-different-types-oauth-20-clients
client credentials flow

https://learn.microsoft.com/en-us/linkedin/shared/authentication/client-credentials-flow?context=linkedin%2Fcontext

require scopes (r_liteprofile, w_member_social)

https://stackoverflow.com/a/65652798/95733
You need to select an enterprise product, like the Marketing Developer Platform. Go to your app and request access to this product. Your app needs to be reviewed first so this may take some time.

## refresh  tokens

https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens

LinkedIn supports programmatic refresh tokens for all approved Marketing Developer Platform (MDP) partners.
By default, access tokens are valid for 60 days and programmatic refresh tokens are valid for a year.

## post api (legacy, detailed)

https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api?view=li-lms-unversioned&tabs=http

## restliClient

https://github.com/linkedin-developers/linkedin-api-js-client/blob/master/examples/create-posts.ts

## simple text post 
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/posts-api?view=li-lms-2023-11&tabs=http#create-a-post

## image

### single image 
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/posts-api?view=li-lms-2023-10&tabs=http#single-post-creation-sample-request

get a lease
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/images-api?view=li-lms-2023-10&tabs=http#sample-request

upload image
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/vector-asset-api?view=li-lms-2023-10&tabs=http#upload-the-image

create a post 
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/posts-api?view=li-lms-2023-10&tabs=http#single-post-creation-sample-request

### multiple images 

https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/multiimage-post-api?view=li-lms-2023-10&tabs=http#create-multiimage-content

get a lease
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/images-api?view=li-lms-2023-10&tabs=http#sample-request

upload image
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/vector-asset-api?view=li-lms-2023-10&tabs=http#upload-the-image

create post 
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/multiimage-post-api?view=li-lms-2023-10&tabs=http#sample-request


## video

https://jcergolj.me.uk/publish-linkedin-post-with-video/ (lgc)

get a lease 
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/videos-api?view=li-lms-2023-10&tabs=http#initialize-video-upload
OR
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/vector-asset-api?view=li-lms-2023-10&tabs=http#register-an-upload-for-video

upload video
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/videos-api?view=li-lms-2023-10&tabs=http#upload-the-video

finalize upload 
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/videos-api?view=li-lms-2023-10&tabs=http#finalize-video-upload




