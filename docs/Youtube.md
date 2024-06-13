# Platform: YouTube

The `youtube` platform manages a youtube **channel** 
using `@googleapis/youtube` and `google-auth-library`.

To upload public videos, your app needs to be verified / audited first.

By using Fairpost on YouTube, you are agreeing to be bound by 
the YouTube Terms of Service: https://www.youtube.com/t/terms

Your posts will be preprocessed to fit YouTube. The limitations 
imposed by Fairpost are not imposed by YouTube. 


## Set up the platform


### Create a new project in your account

Google has a wizard to create a youtube app: https://console.developers.google.com/start/api?id=youtube
Below is how to do it manually.

 - Log in to Google Developers Console: https://console.cloud.google.com/cloud-resource-manager
 - Create a new project.
   - set it to external, testing. only test users can use it
 - Go to the project dashboard, currently at https://console.cloud.google.com/home/dashboard?project={yourproject}
 - click Explore & Enable APIs.
 - In the library, navigate to YouTube Data API v3 under YouTube APIs.
   - enable that
 - Create an OAuth consent screen
   - website https://github.com/commonpike/fairpost
   - privacy https://github.com/commonpike/fairpost/blob/develop/public/privacy-policy.md
   - for the scopes, add YouTube Data API v3
 - Under credentials, create OAuth 2.0 Client IDs
   - Save as `FAIRPOST_YOUTUBE_CLIENT_ID` and `FAIRPOST_YOUTUBE_CLIENT_SECRET` in your global .env

### Get your app audited

You can already proceed below to test the app for private videoos.
To have Fairpost publish **public** videos, your app has to be audited

 - go to https://support.google.com/youtube/contact/yt_api_form
 - request an audit 
   - For the website, link to https://github.com/commonpike/fairpost
   - For the 'document describing your implementation', post this file
 - wait.

## Connect the platform to a user

### Enable the platform
 - Add 'youtube' to your `FAIRPOST_FEED_PLATFORMS` in your users `.env`

### Get an OAuth2 Access Token for your platform

This token last for a few hours and should be refreshed.
The refresh token (if given) lasts until it is revoked.

 - call `./fairpost.js @userid setup-platform --platform=youtube`
 - follow instructions from the command line

### Test the platform
 - call `./fairpost.js @userid test-platform --platform=youtube`



## Connect the platform to another user

- call `./fairpost.js create-user --user=foo` 
- add youtube to its FAIRPOST_PLATFORMS

### Get an OAuth2 Access Token for your other page

 - call `./fairpost.js @foo setup-platform --platform=youtube`
 - follow instructions from the command line

### Test the other installation
 - call `./fairpost.js @foo test-platform --platform=youtube`

## More user settings 

- `FAIRPOST_YOUTUBE_PRIVACY` = public | private | unlisted
- `FAIRPOST_YOUTUBE_CATEGORY` = valid youtube category id
- `FAIRPOST_YOUTUBE_PLUGIN_SETTINGS` - a json object describing / overwriting the plugins used to prepare posts

# Limitations 

## Video 

### Supported Formats
Accepted Media MIME types: 
video/*, application/octet-stream

### File Size
Maximum file size: 256GB


# Random documentation

https://developers.google.com/youtube/v3

https://developers.google.com/youtube/v3/docs/videos/insert

https://developers.google.com/youtube/v3/docs/videos#resource

https://developers.google.com/youtube/v3/guides/auth/installed-apps#chrome

https://blog.hubspot.com/website/how-to-get-youtube-api-key

scopes
https://www.googleapis.com/auth/youtube.force-ssl	
https://www.googleapis.com/auth/youtube.readonly	
https://www.googleapis.com/auth/youtube.upload	

https://googleapis.dev/nodejs/googleapis/latest/slides/

https://pixelswap.fr/entry/how-to-upload-a-video-on-youtube-with-nodejs/

https://stackoverflow.com/questions/65258438/how-to-upload-video-to-youtube-using-google-api-without-libraries

https://developers.google.com/youtube/terms/required-minimum-functionality


https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest/google-auth-library/oauth2client

refreshAccessToken(callback)
refreshToken(refreshToken)
refreshTokenNoCache(refreshToken)
getAccessToken()
isTokenExpiring()


https://googleapis.dev/nodejs/google-auth-library/9.8.0/#oauth2

https://google-auth.readthedocs.io/en/stable/reference/google.oauth2.credentials.html
https://googleapis.dev/nodejs/google-auth-library/8.5.2/interfaces/Credentials.html
https://googleapis.dev/nodejs/google-auth-library/8.5.2/interfaces/GetAccessTokenResponse.html