
<img src="https://github.com/commonpike/fairpost/raw/main/public/fairpost-icon.png" width="64" height="64">

# Fairpost

Fairpost helps you manage users social media feeds from a single 
entry point, using Node. It supports Facebook, Instagram, 
Reddit, Twitter, YouTube and LinkedIn.

A Feed is just a folder on disk, and all subfolders are Source Posts, 
containing at least one text file (the post body) and 
optionally images or video. The Source Post will be transformed
into real posts for each connected platform.

Fairpost is *opinionated*, meaning, it will decide
how a SourcePost with contents can best be presented
as a Post on each platform. 

For each platform, you'll have to register the app on the
platform. This usually results in an AppId and AppSecret or 
something similar, which should be stored in global config.

Then for each user, you'll have to allow the app to
post on their behalf. This is usually done via an
online (oauth) consent page.

Commonly, you would call this script every day or week
for every user. Fairpost can then automatically **prepare** the folders,
**schedule** the next post using a certain interval and 
**publish** any post when it is due. All the user has to do is 
add folders with content.

Or, if you prefer, you can manually publish one
specific folder as posts on all supported and enabled 
platforms at once, or just one post on one platform,
etcetera.


## Setting up 
```
# install
npm install

# compile typescript code
npm run build

# copy and edit fairpost config file
cp .env.dist .env && nano .env

# run
./fairpost.js help
```

### Enable platforms

Read how to enable various social media platforms in the [docs](docs).

### Create a user and connect a platform 

```
# create a user foobar
./fairpost.js create-user --userid=foobar

# edit the users .env, finetune settings
# and enable platform `bla`
nano users/foobar/.env

# connect platform `bla` to user `foobar`
./fairpost.js @foobar setup-platform --platform=bla

```

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
fairpost: help
fairpost: create-user --userid=xxx
fairpost: @user get-feed 
fairpost: @user setup-platform --platform=xxx
fairpost: @user setup-platforms [--platforms=xxx,xxx]
fairpost: @user test-platform --platform=xxx
fairpost: @user test-platforms [--platforms=xxx,xxx]
fairpost: @user refresh-platform --platform=xxx
fairpost: @user refresh-platforms [--platforms=xxx,xxx]
fairpost: @user get-platform --platform=xxx
fairpost: @user get-platforms [--platforms=xxx,xxx]
fairpost: @user get-folder --folder=xxx
fairpost: @user get-folders [--folders=xxx,xxx]
fairpost: @user get-post --post=xxx:xxx
fairpost: @user get-posts [--status=xxx] [--folders=xxx,xxx] [--platforms=xxx,xxx] 
fairpost: @user prepare-post --post=xxx:xxx
fairpost: @user schedule-post --post=xxx:xxx --date=xxxx-xx-xx 
fairpost: @user schedule-posts [--folders=xxx,xxx|--folder=xxx] [--platforms=xxx,xxx|--platform=xxx] --date=xxxx-xx-xx
fairpost: @user publish-post --post=xxx:xxx [--dry-run]
fairpost: @user publish-posts [--folders=xxx,xxx|--folder=xxx] [--platforms=xxx,xxx|--platform=xxx]

# feed planning:
fairpost: @user prepare-posts  [--folders=xxx,xxx|--folder=xxx] [--platforms=xxx,xxx|--platform=xxx]
fairpost: @user schedule-next-post [--date=xxxx-xx-xx] [--folders=xxx,xxx] [--platforms=xxx,xxx] 
fairpost: @user publish-due-posts [--folders=xxx,xxx] [--platforms=xxx,xxx] [--dry-run]

# api server
fairpost: serve
```

### Common arguments 

```
# Set the cli output format to pure json
fairpost.js [command] [arguments] --output=json

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

For more detailed instructions look at [How to add a new platform](./docs/NewPlatform.md)

Oh, and send me a PR if you create anything useful :-) 






