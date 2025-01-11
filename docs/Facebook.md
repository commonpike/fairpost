# Platform: Facebook

The `facebook` platform manages a facebook **page** (not your feed)
using the plain graph api - no extensions installed.


## Set up the platform


### Create a new App in your facebook account
 - go to https://developers.facebook.com/
 - create an app that can manage pages 
 - under 'settings', find your app ID 
   - save this as `FAIRPOST_FACEBOOK_APP_ID` in your global .env
 - under 'settings', find your app secret
   - save this as `FAIRPOST_FACEBOOK_APP_SECRET` in your global .env
 - keep the app under development, otherwise the localhost return url wont work

## Connect the platform to a user

### Enable the platform
 - Add 'facebook' to your `FAIRPOST_FEED_PLATFORMS` in your users `.env`


### Find the page id of the page you want the app to manage
  - go to https://business.facebook.com/
  - find your page (currently under 'settings > accounts > pages')
  - save the page id as `FAIRPOST_FACEBOOK_PAGE_ID` in your users .env

### Get a (long lived) Page Access Token for the page you want the app to manage

This token should last forever. It involves getting a user access token,
exchanging it for  a long-lived user token and 
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
- call `./fairpost.js @userid setup-platform --platform=facebook`
- follow instructions from the command line

### Test the platform
 - call `./fairpost.js @userid test-platform --platform=facebook`

### Set the App to Live Mode
before you use the app, set the App Mode to 'Live'
  - go to https://developers.facebook.com/
  - select your app, edit it 
  - set App Mode to 'live'
  - use https://github.com/commonpike/fairpost/blob/master/public/privacy-policy.md for the privacy policy url



## Connect the platform to another user

One fairpost user can only manage one page. If you create a second user, you can use the same app to manage a different page. The app is registered on your account, so if you can manage the other page, so can the app. 

### Add a second user 
- call `./fairpost.js create-user --userid=foo` 

### Enable the app on the other page 

- Go to https://www.facebook.com/settings/?tab=business_tools
- edit the app and check the boxes of the other pages you want to manage.

### Get a access token for the other page

- set your app back in dev mode 
  - go to https://developers.facebook.com/
  - select your app, edit it 
  - set App Mode to 'dev'
- call `./fairpost.js @foo setup-platform  --platform=facebook`
- follow instructions from the command line
- put your app back in live mode 

### Test the platform for the other page
 - call `./fairpost.js @foo test-platform --platform=facebook`

## More user settings 

 - `FAIRPOST_FACEBOOK_PLUGIN_SETTINGS` - a json object describing / overwriting the plugins used to prepare posts
 - `FAIRPOST_FACEBOOK_PUBLISH_POSTS` - if false, posts will be posted but not be published

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