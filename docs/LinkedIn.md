# Platform: LinkedIn

The LinkedIn platform posts to your companies feed.

## Setting up the LinkedIn platform


### Create a new App in your linkedin account
- create an company your account can manage
- find your company id (like , 93841222)
  - save this as `FAIRPOST_LINKEDIN_COMPANY_ID` in your .env
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
    in your `.env`
  - add redirect url for your app as set in your .env (http://localhost:8000/callback)


### Enable the platform
 - Add 'linkedin' to your `FAIRPOST_FEED_PLATFORMS` in `.env`

### Get an OAuth2 Access Token for your platform

This token last for 60 days and should be refreshed.
The refresh token (if given) lasts for 1 year.

 - call `./fairpost.js setup-platform --platform=linkedin`
 - follow instructions from the command line

### Test the platform
 - call `./fairpost.js test-platform --platform=linkedin`

# Limitations 

## Images 

...

### Supported Formats

...

### File Size

xxx

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




