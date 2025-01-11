# Platform: Reddit

## Set up the platform

### Create a new App in your Reddit account

- go to https://www.reddit.com/prefs/apps
- create an app ('script')
  - redirect url with host/port from your .env (http://localhost:8000/callback)
- note the code and secret in your app box
  - save as `FAIRPOST_REDDIT_CLIENT_ID` in your global .env
  - save as `FAIRPOST_REDDIT_CLIENT_SECRET` in your global .env
- read the terms here https://www.reddit.com/wiki/api/#wiki_read_the_full_api_terms_and_sign_up_for_usage
- request access to the API using the request form, and wait until approved

## Connect the platform to a user

### Enable the platform
 - Add 'reddit' to your `FAIRPOST_FEED_PLATFORMS` in your users `storage.json`

### Get an OAuth2 Access Token for your Reddit account

This token only lasts for 24 hours and should be refreshed.

 - call `./fairpost.js @userid setup-platform --platform=reddit`
 - follow instructions from the command line


### Test the platform
 - call `./fairpost.js @userid test-platform --platform=reddit`
   
## More user settings 

 - `REDDIT_PLUGIN_SETTINGS` - a json object describing / overwriting the plugins used to prepare posts

# Random documentation

https://www.reddit.com/r/test/

https://www.reddit.com/prefs/apps

https://www.reddit.com/wiki/api/#wiki_read_the_full_api_terms_and_sign_up_for_usage

duration permanent -> refresh
scope submit

https://github.com/reddit-archive/reddit/wiki/OAuth2

GET https://www.reddit.com/api/v1/authorize?client_id=CLIENT_ID&response_type=TYPE&
    state=RANDOM_STRING&redirect_uri=URI&duration=DURATION&scope=SCOPE_STRING

POST https://www.reddit.com/api/v1/access_token
    grant_type=authorization_code&code=CODE&redirect_uri=URI
    Authorization: Basic Auth (client_id:client_secret)
{
    "access_token": Your access token,
    "token_type": "bearer",
    "expires_in": Unix Epoch Seconds,
    "scope": A scope string,
    "refresh_token": Your refresh token
}

POST https://www.reddit.com/api/v1/access_token
    grant_type=refresh_token&refresh_token=TOKEN
    Authorization: Basic Auth (client_id:client_secret)


https://www.reddit.com/dev/api

https://www.reddit.com/dev/api/oauth#POST_api_submit


~~ https://github.com/reddit-archive/reddit/wiki/OAuth2

https://www.reddit.com/r/redditdev/comments/9li6le/reddit_api_how_do_i_authenticate_trying_to_do/


https://www.reddit.com/r/redditdev/comments/x53h1y/having_trouble_submitting_an_image_post/

https://github.com/rvelasq/scriptable-selig

https://github.com/rvelasq/scriptable-selig/blob/master/Selig.js#L855


https://github.com/Pyprohly/reddit-api-doc-notes/blob/main/docs/api-reference/submission.rst#upload-media

upload video

https://creatomate.com/blog/how-to-use-ffmpeg-in-nodejs

https://www.reddit.com/r/redditdev/comments/9x3a6c/comment/e9p9cet/?utm_source=share&utm_medium=web2x&context=3
https://oauth.reddit.com/api/v2/image_upload_s3.json
similar to upload emoji
https://www.reddit.com/dev/api/#POST_api_widget_image_upload_s3


https://github.com/praw-dev/praw/blob/master/praw/models/reddit/subreddit.py#L1699
"upload_image":            "r/{subreddit}/api/upload_sr_img",
data["img_type"] = "jpg"
files={"file": image}


https://www.npmjs.com/package/reddit-api-image-upload
