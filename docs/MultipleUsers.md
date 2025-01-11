# Set up for multiple users

For each feed/page/channel/etc, Fairpost uses one 'user' that has it's own configuration, logging and feed folder.
If you don't specify a user, Fairpost assumes it's 'admin'. The admin user has no homedir and uses global config, logging and storage.


## User storage

The global .env stores global (app) settings.

The other stores, like access tokens, will be stored in the user directory 
in the path specified in the global .env

The users storage can override some things from the global config, but likely, you only want
to enter the feed/page/channel/etc settings for each platform. The rest is set globally.

## User logging

When command are called on behalf of a user, `./log4js.json` uses the 
'user' category instead of the default category. It logs in a dedicated
logfile for the user, but also append some messages to the global log.

The user could also host it's own log4js.json; settings there would 
completely override the settings in the global log4j.json.
