# Platform: LinkedIn

...

## Setting up the LinkedIn platform


### Create a new App in your linkedin account
- create an company your account can manage
- create an app to manage the company page \
https://www.linkedin.com/developers/apps/new
- add 'share on linkedin' and 'advertising api' product to the app
- on the 'settings' tab of your app
  - click the 'verify' button next to the page you want the app to manage \
    and follow instructions there
- on the 'auth' tab of your app
  - copy ClientID and ClientSecret \
    and save those as `FAIRPOST_LINKEDIN_CLIENT_ID` and `FAIRPOST_LINKEDIN_CLIENT_SECRET` \
    in your `.env`
  - make sure you have `w_member_social w_organization_social`
  - add redirect url for your app as in .env (http://localhost:8000/callback)


### Get an access token (...)

https://learn.microsoft.com/en-us/linkedin/shared/authentication/postman-getting-started

We need the 3-legged oauth, because 2-legged oauths is only if 
> your application needs to access APIs that are not member specific

- go to https://www.linkedin.com/developers/apps
- select your app
- on the auth app
  - add https://oauth.pstmn.io/v1/callback as redirect url
  - add https://oauth.pstmn.io/v1/browser-callback as redirect url
- copy this collection into postman : https://www.postman.com/fairpost-test/workspace/linkedin
- enter client id and client secret in postman collection env

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

## refresh  tokens

https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens

LinkedIn supports programmatic refresh tokens for all approved Marketing Developer Platform (MDP) partners.
By default, access tokens are valid for 60 days and programmatic refresh tokens are valid for a year.

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






