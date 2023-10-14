# Fairpost

Fairpost helps you manage your social
feeds from the command line, using Node.

Each post is a folder, containing at least one 
text file (the post body) and optionally images
or a video. 

To smoothly maintain your feed, you can run 
fairpost every day. Fairpost will prepare and 
schedule new content to be published on all your 
platforms on a regular basis, while
you can just focus on creating new content.

Or, if you prefer, you can manually publish one
specific post on all supported and enabled 
platforms at once.

Edit the .env file to manage the platforms
you want to support, the interval for new posts,
etcetera. For each platform, you'll have to 
register the app to post on your behalf.

## Setting up 
```
# install
npm install

# compile typescript code
tsc

# copy and edit config file
cp .env.dist .env && nano .env

# run
./fairpost.js help
```

## Prepare
```
fairpost.js prepare-posts
```
Folders need to be `prepared` (iow turned into posts)
before they can be published to a platform. 
Each platform, as defined in src/platforms, will 
handle the folder contents by itself. It may
decide to modify the media (eg, scale images) 
before posting, or not to post the folder (eg, 
when it only contains images and the platform 
is youtube). Finally, it will add a json file
describing the post for that platform in the 
folder.

## Schedule
```
fairpost.js schedule-next-post
```
The next post can then be `scheduled`. For each platform,
if there is not already a scheduled post, this will update
the json file in one post to set the status to scheduled, 
and set the schedule date. 
By default the date will be `FAIRPOST_FEED_INTERVAL` days 
after the last post for that platform, or `now`, whichever 
is latest.

## Publish
```
fairpost.js publish-due-posts
```
This will publish any scheduled posts that are past their due date.


## Other commands

Other commands accept `--arguments`
that may help you, for example, to immediately publish
a certain post to a certain platform if you like.

But more commonly, you would call this script
every day. 
The script will then automatically prepare the posts,
schedule the next post using a certain interval, 
publish any post when it is due, and schedule the 
next post automatically. All you have to do is 
add folders with content.



## Cli

```
# basic commands:
fairpost.js help
fairpost.js get-feed [--config=xxx]
fairpost.js test-platform --platform=xxx
fairpost.js test-platforms [--platforms=xxx,xxx]
fairpost.js get-platform --platform=xxx
fairpost.js get-platforms [--platforms=xxx,xxx]
fairpost.js get-folder --folder=xxx
fairpost.js get-folders [--folders=xxx,xxx]
fairpost.js get-post --folder=xxx --platform=xxx
fairpost.js get-posts [--status=xxx] [--folders=xxx,xxx] [--platforms=xxx,xxx] 
fairpost.js prepare-post --folder=xxx --platform=xxx
fairpost.js schedule-post --folder=xxx --platform=xxx --date=xxxx-xx-xx 
fairpost.js schedule-posts [--folders=xxx,xxx] [--platforms=xxx,xxx] --date=xxxx-xx-xx
fairpost.js publish-post --folders=xxx --platforms=xxx [--dry-run]
fairpost.js publish-posts [--folders=xxx,xxx] [--platforms=xxx,xxx]

# feed planning:
fairpost.js prepare-posts [--folders=xxx,xxx] [--platforms=xxx,xxx]
fairpost.js schedule-next-post [--date=xxxx-xx-xx] [--folders=xxx,xxx] [--platforms=xxx,xxx] 
fairpost.js publish-due-posts [--folders=xxx,xxx] [--platforms=xxx,xxx] [--dry-run]

# platform tools:
fairpost.js facebook-get-page-token --app-user-id=xxx --user-token=xxx
```

### Common arguments 

```
# Select which config file to use
fairpost.js [command] [arguments] --config=.env-test

# Set the cli output format to pure json
fairpost.js [command] [arguments] --report=json

```


## Add a new platform

To add support for a new platform, add a class to `src/platforms`
extending `src/classes/Platform`. You want to override at least the
method `preparePost(folder: Folder)` and 
`publishPost(post: Post, dryrun:boolean = false)`.

Then add a platformId for your platform to `src/platforms/index.js` and
enable your platform in your `.env`.


