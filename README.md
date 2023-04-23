# Ayrshare-feed

Ayrshare feed helps you manage your ayrshare
feed from the command line.

Each post is a folder, containing
- body.txt (txt, required)
- images (png,jpg,optional)
- one video (mp4, optional)
after posting, a postfile is added (post.json)

The script typically determines the post type 
by looking at the folders contents,
and decides which platforms that post type
is suitable for.

Posts typically sit in a `feed` folder;
this script typically checks which posts 
have not been processed yet and processes
these, unless you specify posts on the
command line.

The first post is scheduled at an interval
after the last successful post, or today,
unless a date is given on the command line.
Subsequent posts are scheduled at an interval
after each previous successful post.

TODO
The script also processes the media, resizing
images and cropping video where needed. Specific
limits for each platform are applied automatically.

## cli

node index.js 
  --dry-run
  --debug
  --platforms=x[,y,..]|all 
  --date=yyyy-mm-dd|now
  --posts=dir1[,dir2,..]|feed
  --interval=7
  --type=text|images|video|auto



