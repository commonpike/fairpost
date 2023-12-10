
<img src="https://github.com/commonpike/fairpost/raw/main/public/fairpost-icon.png" width="64" height="64">

# Fairpost

Fairpost helps you manage your social media feeds from a single 
entry point, using Node. It supports Facebook, Instagram, 
Reddit, Twitter and LinkedIn.

Your Feed is just a folder on disk, and all subfolders are Posts, 
containing at least one text file (the post body) and 
optionally images or video. 
Fairpost is *opinionated*, meaning, it will decide
how a folder with contents can best be presented
as a post on each platform. 

Commonly, you would call this script every day or week. 
Fairpost can then automatically **prepare** the folders,
**schedule** the next post using a certain interval and 
**publish** any post when it is due. All you have to do is 
add folders with content.

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
npm run build

# copy and edit config file
cp .env.dist .env && nano .env

# run
./fairpost.js help
```
 
## Enable platforms

Read how to enable various social media platforms in the [docs](docs).


## Feed planning
### Prepare
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

### Schedule
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

### Publish
```
fairpost.js publish-due-posts
```
This will publish any scheduled posts that are past their due date.


## Other commands

Other commands and `--arguments`
may help you to, for example, immediately publish
a certain post to a certain platform if you like.

### Refresh tokens

Access and refresh tokens for various platforms may
expire sooner or later. Before you do anything, try
`fairpost.js refresh-platforms`. Eventually, even
refresh tokens may expire, and you will have to run
`fairpost.js setup-platform --platform=bla` again
to get a new pair of tokens.


### Cli

```
# basic commands:
fairpost.js help
fairpost.js get-feed [--config=xxx]
fairpost.js setup-platform --platform=xxx
fairpost.js setup-platforms [--platforms=xxx,xxx]
fairpost.js test-platform --platform=xxx
fairpost.js test-platforms [--platforms=xxx,xxx]
fairpost.js refresh-platform --platform=xxx
fairpost.js refresh-platforms [--platforms=xxx,xxx]
fairpost.js get-platform --platform=xxx
fairpost.js get-platforms [--platforms=xxx,xxx]
fairpost.js get-folder --folder=xxx
fairpost.js get-folders [--folders=xxx,xxx]
fairpost.js get-post --folder=xxx --platform=xxx
fairpost.js get-posts [--status=xxx] [--folders=xxx,xxx] [--platforms=xxx,xxx] 
fairpost.js prepare-post --folder=xxx --platform=xxx
fairpost.js schedule-post --folder=xxx --platform=xxx --date=xxxx-xx-xx 
fairpost.js schedule-posts [--folders=xxx,xxx] [--platforms=xxx,xxx] --date=xxxx-xx-xx
fairpost.js publish-post --folder=xxx --platform=xxx [--dry-run]
fairpost.js publish-posts [--folders=xxx,xxx] [--platforms=xxx,xxx]

# feed planning:
fairpost.js prepare-posts [--folders=xxx,xxx] [--platforms=xxx,xxx]
fairpost.js schedule-next-post [--date=xxxx-xx-xx] [--folders=xxx,xxx] [--platforms=xxx,xxx] 
fairpost.js publish-due-posts [--folders=xxx,xxx] [--platforms=xxx,xxx] [--dry-run]
```

### Common arguments 

```
# Select which config file to use
fairpost.js [command] [arguments] --config=.env-test

# Set the cli report format to pure json
fairpost.js [command] [arguments] --report=json

# Enable trace logging output to the console (overriding .env)
fairpost.js [command] [arguments] --verbose

```


## Add a new platform

To add support for a new platform, add a class to `src/platforms`
extending `src/classes/Platform`. You want to override at least the
method `preparePost(folder)` and  `publishPost(post,dryrun)`.

Then import your class and add a `platformId` for your platform 
in `src/platforms/index.ts` and enable your platformId in your `.env`.

Similarly, you can copy one platform, rename it and edit it to your
likings, give it a different `platformId` and enable that.

Oh, and send me a PR if you create anything useful :-) 






