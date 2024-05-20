# Platform: Ayrshare

Ayrshare (https://www.ayrshare.com/) is a platform / service
that does what FairPost does. I don't know why you would
use both.

But if you have an Ayrshare account, you can enable
it here and enable the platforms that you have connected
to Ayrshare, to publish to those platforms via Ayrshare.

An Ayrshare account can only manage each platform
once per user; you will have to create a new account
for each user. 

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


## Connect the platform to a user

### Get an api key for the user

- get an account at Ayrshare
- get your Api key at https://app.ayrshare.com/api
- store this key as FAIRPOST_AYRSHARE_API_KEY in your users .env

### Enable and test a random platform
 - Add one or more of the 'as*' platforms to `FAIRPOST_FEED_PLATFORMS` in the users `.env`
 - call `./fairpost.js @userid test-platforms`

# Limitations 

Ayrshare applies different limitations to each platform.
For details, check the Ayrshare documentation.