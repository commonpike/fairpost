/*
    Usage

    tsc && node build/fayrshare.js
    node build/fayrshare.js .. 

    fayrshare.js get-feed [--config=xxx]
    fayrshare.js get-folders
    fayrshare.js prepare-posts [--platforms=xxx] [--folders=xxx]
    fayrshare.js get-posts [--status=xxx] [--platforms=xxx] [--folders=xxx]
    fayrshare.js schedule-next-post [--platforms=xxx] [--folders=xxx]
    fayrshare.js publish-due-posts [--platforms=xxx] [--folders=xxx]
    
*/

import Feed from './src/classes/Feed';

const feed = new Feed('.env-fayrshare');
//console.log(feed.getPlatforms());
//console.log(feed.getFolders());
// console.log(feed.getPosts());
//console.log(feed.getPosts({paths:['0048-coimbrium-ceil']}));
feed.preparePosts().then(f=>console.log(f));
