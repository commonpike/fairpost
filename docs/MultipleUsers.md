# Set up for multiple users

By default, Fairpost serves a single user. If
your client is allowed to manage multiple feeds/pages/channels/etc. on some platforms, you can change it to manage those.

For each feed/page/channel/etc, Fairpost uses one 'user' that has it's own configuration, logging and feed folder.

At least one user called `admin` is required.
If you don't specify a user, Fairpost assumes it's 'admin'.

## Setup

```
mkdir ./users
cp -a ./etc/skeleton ./users/admin
cp -a ./etc/skeleton ./users/foobar
mv ./users/foobar/.env.dist ./users/foobar/.env

# enter your users platform details:
nano ./users/foobar/.env

# change the global .env to multi-user setup:
# - comment out 'app single user settings'
# - uncomment 'app multi user settings'
nano .env

# test it 
./fairpost.js @foobar get-user
```

## User storage

Both the global .env and the user .env will be read.
The users .env can override anything 
from the global config, but likely, you only want
to enter the feed/page/channel/etc settings for each platform. The rest is set globally.

The other stores, like access tokens, will also be stored in the user directory in the path specified in his .env

## Separate logging

To enable seperate logging for seperate users,
edit `./log4js.json` and change 
```
"categories": {
    "default": { "appenders": ["global"], "level": "info" }
  }
```
  to
```
  "categories": {
    "default": { "appenders": ["user","global-filtered"], "level": "info" }
  }
```

This will generate two logfiles: one `./users/foobar/var/log/fairpost.log` and one in `./var/log/fairpost.log`, each with possibly different logging levels.

The user could also host it's own log4js.json; settings there would completely override the settings in the global log4j.json.
