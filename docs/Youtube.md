# Platform: Youtube

--The `youtube` platform manages a youtube **channel** 

## Setting up the YouTube platform


### Create a new project in your account

 - Log in to Google Developers Console.
 - Create a new project.
   - set it to external, testing. only test users can use it
 - Got to the project dashboard, currently at https://console.cloud.google.com/home/dashboard?project={yourproject}
 - click Explore & Enable APIs.
 - In the library, navigate to YouTube Data API v3 under YouTube APIs.
   - enable that
 - Create an OAuth consent screen
   - website https://github.com/commonpike/fairpost
   - privacy https://github.com/commonpike/fairpost/blob/develop/public/privacy-policy.md
   - for the scopes, add YouTube Data API v3
 - Under credentials, create OAuth 2.0 Client IDs
   - Save as `FAIRPOST_YOUTUBE_CLIENT_ID` and `FAIRPOST_YOUTUBE_CLIENT_SECRET`

### Enable the platform
 - Add 'youtube' to your `FAIRPOST_FEED_PLATFORMS` in `.env`

### Get an OAuth2 Access Token for your platform

This token last for a few hours and should be refreshed.
The refresh token (if given) lasts until it is revoked.

 - call `./fairpost.js setup-platform --platform=youtube`
 - follow instructions from the command line

### Test the platform
 - call `./fairpost.js test-platform --platform=youtube`

### Other settings 

## Manage additional pages with the same app

...

# Limitations 

## Images 
### Supported Formats


### File Size


# Random documentation

https://developers.google.com/youtube/v3

https://developers.google.com/youtube/v3/guides/auth/installed-apps#chrome

https://blog.hubspot.com/website/how-to-get-youtube-api-key

scopes
https://www.googleapis.com/auth/youtube.force-ssl	
https://www.googleapis.com/auth/youtube.readonly	
https://www.googleapis.com/auth/youtube.upload	