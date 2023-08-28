/*
    Usage

    tsc && node build/fayrshare.js
    node build/fayrshare.js .. 

*/

import Feed from './src/classes/Feed';

const feed = new Feed('.env-fayrshare');
//console.log(feed.getPlatforms());
//console.log(feed.getFolders());
// console.log(feed.getPosts());
//console.log(feed.getPosts({paths:['0048-coimbrium-ceil']}));
console.log(feed.preparePosts({paths:['0048-coimbrium-ceil']}));
