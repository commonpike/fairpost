# Platform: Facebook

The `facebook` platform manage a facebook **page* (not your feed)
using the plain graph api - no extensions installed.

## Setting up the Facebook platform


### Create a new App in your facebook account
 - go to https://developers.facebook.com/
 - create an app that can manage pages 
 - under 'settings', find your app ID 
   - save this as `FAIRPOST_FACEBOOK_APP_ID` in your .env
 - under 'settings', find your app secret
   - save this as `FAIRPOST_FACEBOOK_APP_SECRET` in your .env
 - before you use the app, set the App Mode to 'Live'
   - use https://github.com/commonpike/fairpost/blob/master/public/privacy-policy.md for the privacy policy url
### Find the page id of the page you want the app to manage
  - go to https://business.facebook.com/
  - find your page (currently under 'settings > business assets')
  - save the page id as `FAIRPOST_FACEBOOK_PAGE_ID` in your .env

### Enable the platform
 - Add 'facebook' to your `FAIRPOST_FEED_PLATFORMS` in `.env`

### Get a (long lived) Page Access Token for the page you want the app to manage

This token should last forever. It involves getting a user access token,
exchaning it for  a long-lived user token and 
then requesting the 'accounts' for your 'app scoped user id'; 
but this app provides a tool to help you do that: 

 - call `./fairpost.js setup-platform --platform=facebook`
 - follow instructions from the command line

### Test the platform
 - call `./fairpost.js test-platform --platform=facebook`

# Limitations 

## Images 

From https://developers.facebook.com/docs/graph-api/reference/page/photos/ :

Facebook strips all location metadata before publishing and resizes images to different dimensions to best support rendering in multiple sizes.


### Supported Formats
Facebook supports the following formats:
 - JPEG
 - BMP
 - PNG
 - GIF
 - TIFF

### File Size

Files must be 4MB or smaller in size.
For PNG files, try keep the file size below 1 MB. PNG files larger than 1 MB may appear pixelated after upload.

# Random documentation

https://dev.to/xaypanya/how-to-connect-your-nodejs-server-to-facebook-page-api-1hol
https://developers.facebook.com/docs/pages/getting-started
https://developers.facebook.com/docs/pages-api/posts
https://developers.facebook.com/docs/graph-api/reference/page/photos/
https://developers.facebook.com/docs/video-api/guides/publishing

large uploads:
https://developers.facebook.com/docs/graph-api/guides/upload/

https://www.npmjs.com/package/formdata-node
https://medium.com/deno-the-complete-reference/sending-form-data-using-fetch-in-node-js-8cedd0b2af85

https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow