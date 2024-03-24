# Platform: Ayrshare

Ayrshare (https://www.ayrshare.com/) is a platform / service
that does what FairPost does. I don't know why you would
use both.

But if you have an Ayrshare account, you can enable
it here and enable the platforms that you have connected
to Ayrshare, to publish to those platforms via Ayrshare.

Ayrshare posts will not be scheduled on Ayrshare; 
they will be published instantly. Use Fairpost for
scheduling posts.

The Ayrshare platforms supported by FairPost are 
- asfacebook
- asinstagram
- aslinkedin
- asreddit
- astiktok
- asyoutube

If you only have one user, your user .env is 
the same as your global .env

## Setting up the Ayrshare platform

- get an account at Ayrshare
- get your Api key at https://app.ayrshare.com/api
- store this key as FAIRPOST_AYRSHARE_API_KEY in your global .env

### Enable and test the facebook platform
 - Add one or more of the 'as*' platforms to `FAIRPOST_FEED_PLATFORMS` in the users `.env`
 - call `./fairpost.js test-platforms`

# Limitations 

Ayrshare applies different limitations to each platform.
For details, check the Ayrshare documentation.