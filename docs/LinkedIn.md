# Platform: LinkedIn

...

## Setting up the LinkedIn platform


### Create a new App in your linkedin account
- create an company your account can manage
- create an app to manage the company page \
https://www.linkedin.com/developers/apps/new
- add 'share on linkedin' product to the app
- on the 'settings' tab of your app
  - click the 'verify' button next to the page you want the app to manage \
    and follow instructions there
- on the 'auth' tab of your app
  - copy ClientID and ClientSecret \
    and save those as `FAIRPOST_LINKEDIN_CLIENT_ID` and `FAIRPOST_LINKEDIN_CLIENT_SECRET` \
    in your `.env`


### Get an access token (...)

### Enable and test the platform
 - Add 'linkedin' to your `FAIRPOST_FEED_PLATFORMS` in `.env`
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

## restliClient

https://github.com/linkedin-developers/linkedin-api-js-client/blob/master/examples/create-posts.ts

## image

### single image 
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/posts-api?view=li-lms-2023-10&tabs=http#single-post-creation-sample-request

### multiple images 

https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/multiimage-post-api?view=li-lms-2023-10&tabs=http#create-multiimage-content

### upload image 
https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/images-api?view=li-lms-2023-10&tabs=http#initialize-image-upload

and PUT

https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/vector-asset-api?view=li-lms-2023-10&tabs=http#upload-the-image

## video

https://jcergolj.me.uk/publish-linkedin-post-with-video/





