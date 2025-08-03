# Platform: Blueksy

The `bluesky` platform manages your feed
using the ATProto protocol with service 
https://bsky.social

## Set up the platform

There is nothing to set up. The user supplies
the app with a password, and then the app can
post on the users behalf. 

### Test the platform
 - call `./fairpost.js @userid test-platform --platform=bluesky`

## Connect the platform to another user

You can't. There is only one identifier/password
combination per fairpost user.

## More user settings 

None.

# Limitations 

From https://www.ayrshare.com/docs/media-guidelines/bluesky

## Images 

Max image size: 1 MB.
Supported formats: JPG, Animated GIF, and PNG.
Recommended size for images: 1200 x 627 px.
Annimated GIF will be sent as a video. Only one animated GIF can be sent per post.
​
## Video 

Max video size: 1 GB
Supported formats: MP4.
Duration max: 4 minutes.
Duration min: 1 second.
Aspect ratio must be between 1:3 and 3:1.

# Random documentation
Bluesky does not use oauth yet, so fairposts asks 
the user to create an app password, like so
"""
To let our app post on your behalf, Bluesky requires an App Password.
We will never ask for your main password.
You can create an app password here:
https://bsky.app/settings/app-passwords

Once created, paste it below. You can revoke this at any time from your Bluesky settings.
"""

You can save the JWT (token), but you cant refresh it
without the app password. Store this encrypted.
~~~

convert at:uris to urls 

https://github.com/notjuliet/pdsls/blob/74d45a3a56149d706fe950e2a7123a526d4ac5cf/src/views/record.tsx#L146-L197

~~~~

## Set up the platform

```
await agent.login({ identifier, password })
agent.session = {
  accessJwt: '...',
  refreshJwt: '...',
  did: 'did:plc:...',
  handle: 'your-handle.bsky.social'
}
saveToStorage(userId, session) // You define this
...
const savedSession = loadFromStorage(userId)
const agent = new BskyAgent({ service: 'https://bsky.social' })
agent.session = savedSession
```

If the JWT expires, you'll get a 401, and must call login() again.

```
async function isSessionValid(agent) {
  try {
    await agent.api.com.atproto.server.getSession()
    return true
  } catch (err) {
    if (
      err?.response?.status === 401 ||
      (typeof err.message === 'string' &&
      (err.message.includes('Unauthorized') ||
       err.message.includes('expired') ||
       err.message.includes('invalid token')))
    ) {
        return false
       }
    throw err // some other error
  }
}
```


post 

https://www.ayrshare.com/complete-guide-to-bluesky-api-integration-authorization-posting-analytics-comments/
https://docs.bsky.app/docs/get-started
https://docs.bsky.app/docs/starter-templates/bots


session
```
{
  accessJwt: 'xxx',
  refreshJwt: 'xxx',
  handle: 'fairpostor.bsky.social',
  did: 'did:plc:ifa6qu7emplazfdpnrcmj54i',
  email: 'pike+fairpostor@kw.nl',
  emailConfirmed: true,
  emailAuthFactor: false,
  active: true,
  status: undefined
}
```



post response 
```
{
  uri: 'at://did:plc:ifa6qu7emplazfdpnrcmj54i/app.bsky.feed.post/3ltc2untwpu2a',
  cid: 'bafyreig46rwltcusvzk6jrpki34rhdbkvzl4ue3lobqtptyoesdqzc5ne4',
  commit: {
    cid: 'bafyreifgmizsdgomjpv7bwcmojtazj2jhw4lr2jec5vrdhz3b6xikuy7re',
    rev: '3ltc2unu6ju2a'
  },
  validationStatus: 'valid'
}
```
