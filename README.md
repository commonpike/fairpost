# Fairpost



Ayrshare feed helps you manage your ayrshare
feed from the command line.

Each post is a folder, containing at least one 
text file (the post body) and optionally images
or a video. 

Edit the .env file to manage the platforms
you want to support, amongst others. 

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
before they can be posted to a platform. 
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
The next post can then be `scheduled`. For each platform this just updates the json file in one post to set the status to scheduled, and set the schedule date. By default the date will be `FAIRPOST_FEED_INTERVAL` days after the last post for that platform, or `now`, whichever is latest.

## Publish
```
fairpost.js publish-due-posts
```
This will publish any scheduled posts that are past their due date.


## Arguments

Each of these commands (and others) accept `--arguments`
that may help you, for example, to immediately publish
a certain post to a certain platform if you like.

But more commonly, you would call this script
every day and just add posts to the feed folder as 
time goes by. 
The script will then automatically prepare these posts,
schedule the next post using a certain interval, 
publish any post when it is due, and schedule the 
next post automatically.



## Cli

```
fairpost.js help 
fairpost.js get-feed
fairpost.js get-folders [--folders=xxx,xxx]
fairpost.js prepare-posts [--platforms=xxx,xxx] [--folders=xxx,xxx]
fairpost.js get-posts [--status=xxx] [--platforms=xxx,xxx] [--folders=xxx,xxx]
fairpost.js schedule-next-post [--date=xxxx-xx-xx] [--platforms=xxx,xxx] [--folders=xxx,xxx]
fairpost.js publish-due-posts [--platforms=xxx,xxx] [--folders=xxx,xxx] [--dry-run]
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

Then add a slug for your platform to `src/platforms/index.js` and
enable your platform in your `.env`.


