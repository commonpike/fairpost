# Fairpost

```
tsc && node fairpost.js help
```

Ayrshare feed helps you manage your ayrshare
feed from the command line.

Each post is a folder, containing at least one 
text file (the post body) and optionally images
or a video. 


Edit the .env file to manage the platforms
you want to support, amongst others. 

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

The next post can then be `scheduled`, and
any due posts can be `published` :

```
node fairpost.js prepare-posts
node fairpost.js schedule-next-posts
node fairpost.js publish-due-posts
```

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



## cli

```
node fairpost.js help 
node fairpost.js get-feed [--config=xxx]
node fairpost.js get-folders [--folders=xxx,xxx]
node fairpost.js prepare-posts [--platforms=xxx,xxx] [--folders=xxx,xxx]
node fairpost.js get-posts [--status=xxx] [--platforms=xxx,xxx] [--folders=xxx,xxx]
node fairpost.js schedule-next-post [--date=xxxx-xx-xx] [--platforms=xxx,xxx] [--folders=xxx,xxx]
node fairpost.js publish-due-posts [--platforms=xxx,xxx] [--folders=xxx,xxx] [--dry-run]
```

## Create a new platform

To add support for your own platform, add a class to `src/platforms`
extending `src/classes/Platform`. You want to override at least the
method `preparePost(folder: Folder)` and 
`publishPost(post: Post, dryrun:boolean = false)`.

Then add a slug for your platform to `src/platforms/index.js` and
enable your platform in your `.env`.


