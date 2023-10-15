# Platform: Ayrshare

Ayrshare (https://www.ayrshare.com/) is a platform / service
that does what FairPost does. I don't know why you would
use both.

But if you have an Ayrshare account, you can enable
it here and enable the platforms that you have connected
to Ayrshare, to publish to those platforms via Ayrshare.

The Ayrshare platforms supported by FairPost are 
- asfacebook
- asinstagram
- aslinkedin
- asreddit
- astiktok
- asyoutube

## Setting up the Ayrshare platform

- get an account at Ayrshare
- get your Api key at https://app.ayrshare.com/api
- store this key as FAIRPOST_AYRSHARE_API_KEY

### Enable and test the facebook platform
 - Add one or more of the 'as*' platforms to `FAIRPOST_FEED_PLATFORMS` in `.env`
 - call `./fairpost.js test-platforms`

# Limitations 

Ayrshare applies different limitations to each platform.
For details, check the Ayrshare documentation.