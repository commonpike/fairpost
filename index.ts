/*
    202309*pike
    Fairpost cli handler     
*/

import Logger from './src/Logger';
import Feed from './src/Feed';
import { PostStatus } from './src/Post';
import { PlatformSlug } from './src/platforms';
import Facebook from './src/platforms/Facebook';

// arguments 
const COMMAND = process.argv[2] ?? 'help'

// options
const CONFIG = (getOption('config') as string ) ?? '.env';
const DRY_RUN = !!getOption('dry-run') ?? false;
const REPORT = (getOption('report') as string ) ?? 'text';
const PLATFORMS = (getOption('platforms') as string)?.split(',') as PlatformSlug[] ?? undefined;
const FOLDERS = (getOption('folders') as string)?.split(',') ?? undefined;
const DATE = (getOption('date') as string) ?? undefined;
const STATUS = (getOption('status') as PostStatus) ?? undefined;


// utilities

function getOption(key:string):boolean|string|null {
    if ( process.argv.includes( `--${ key }` ) ) return true;
    const value = process.argv.find( element => element.startsWith( `--${ key }=` ) );
    if ( !value ) return null;
    return value.replace( `--${ key }=` , '' );
}


/* main */
async function main() {

    let result: any;
    let report = '';

    const feed = new Feed(CONFIG);
    Logger.trace('Fairpost '+feed.path+' '+COMMAND,DRY_RUN?' dry-run':'');


    try {
        switch(COMMAND) {
            case 'get-feed':
                result = feed;
                report = 'Feed: '+feed.path;
                break;
            case 'get-platforms':
                const platforms = feed.getPlatforms(PLATFORMS);
                platforms.forEach(platform => {
                    report += 'Platform: '+platform.slug+'\n';
                });
                result = platforms;
                break;
            case 'test-platforms':
                result = await feed.testPlatforms(PLATFORMS);
                report = "Result: \n"+ JSON.stringify(result,null,'\t');
                break;
            case 'get-folders':
                const folders = feed.getFolders(FOLDERS);
                folders.forEach(folder => {
                    report += 'Folder: '+folder.path+'\n';
                });
                result = folders;
                break;
            case 'get-posts':
                const allposts = feed.getPosts({
                    paths:FOLDERS, 
                    platforms:PLATFORMS, 
                    status: STATUS
                });
                allposts.forEach(post => {
                    report += post.report();
                });
                result = allposts;
                break;
            case 'prepare-posts':
                const prepposts = await feed.preparePosts({
                    paths:FOLDERS, 
                    platforms:PLATFORMS 
                });
                prepposts.forEach(post => {
                    report += post.report();
                });
                result = prepposts;
                break;
            case 'schedule-next-posts':
                const nextposts = feed.scheduleNextPosts(DATE ? new Date(DATE): undefined,{
                    paths:FOLDERS, 
                    platforms:PLATFORMS 
                });
                nextposts.forEach(post => {
                    report += post.report();
                });
                result = nextposts;
                break;
            case 'publish-due-posts':
                const pubposts = await feed.publishDuePosts({
                    paths:FOLDERS,
                    platforms:PLATFORMS
                }, DRY_RUN);
                pubposts.forEach(post => {
                    report += post.report();
                });
                result = nextposts;
                break;
            case 'facebook-get-page-token':
                const userToken = (getOption('user-token') as string );
                if (!userToken) {
                    throw new Error('Missing parameter: user-token');
                }
                const appUserId = (getOption('app-user-id') as string );
                if (!appUserId) {
                    throw new Error('Missing parameter: app-user-id');
                }
                const facebook = new Facebook();
                result = await facebook.getPageToken(appUserId, userToken);
                report = 'Page Token: '+result;
                break;
            default: 
                const cmd = process.argv[1];
                result = [
                    `${cmd} help`,
                    `${cmd} get-feed [--config=xxx]`,
                    `${cmd} test [--platforms=xxx,xxx]`,
                    `${cmd} get-platforms [--platforms=xxx,xxx]`,
                    `${cmd} get-folders [--folders=xxx,xxx]`,
                    `${cmd} prepare-posts [--platforms=xxx,xxx] [--folders=xxx,xxx]`,
                    `${cmd} get-posts [--status=xxx] [--platforms=xxx,xxx] [--folders=xxx,xxx]`,
                    `${cmd} schedule-next-post [--date=xxxx-xx-xx] [--platforms=xxx,xxx] [--folders=xxx,xxx]`,
                    `${cmd} publish-due-posts [--platforms=xxx,xxx] [--folders=xxx,xxx] [--dry-run]`,
                    `${cmd} facebook-get-page-token --app-user-id=xxx --user-token=xxx`
                ];
                result.forEach(line => report += '\n'+line);
        }
    } catch (e) {
        console.error(e.message);
    }

    switch(REPORT) {
        case 'json':
            console.log(JSON.stringify(result,null,'\t'));
            break;
        default:
            console.log(report);
    }


}

main();