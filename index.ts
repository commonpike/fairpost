/*
    Usage

    tsc && node build/fayrshare.js
    node build/fayrshare.js .. 

    fayrshare.js help 
    fayrshare.js get-feed [--config=xxx]
    fayrshare.js get-folders
    fayrshare.js prepare-posts [--platforms=xxx] [--folders=xxx]
    fayrshare.js get-posts [--status=xxx] [--platforms=xxx] [--folders=xxx]
    fayrshare.js schedule-next-post [--platforms=xxx] [--folders=xxx]
    fayrshare.js publish-due-posts [--platforms=xxx] [--folders=xxx] [--dry-run]
    
*/

import Feed from './src/classes/Feed';
import { PlatformSlug } from './src/platforms';

// arguments 
const COMMAND = process.argv[2] ?? 'help'

// options
const DRY_RUN = !!getOption('dry-run') ?? false;
const CONFIG = (getOption('config') as string ) ?? '.env';
const PLATFORMS = (getOption('platforms') as string)?.split(',') as PlatformSlug[] ?? undefined;
const FOLDERS = (getOption('folders') as string)?.split(',') ?? undefined;
const DATE = (getOption('date') as string) ?? undefined;
const STATUS = (getOption('status') as string) ?? undefined;


// utilities

function getOption(key:string):boolean|string|null {
    if ( process.argv.includes( `--${ key }` ) ) return true;
    const value = process.argv.find( element => element.startsWith( `--${ key }=` ) );
    if ( !value ) return null;
    return value.replace( `--${ key }=` , '' );
}


/* main */
async function main() {

    const feed = new Feed(CONFIG);
    console.log('Fayrshare '+feed.path+' starting .. ',DRY_RUN?'dry-run':'');
    console.log();

    let result: any = '';
    switch(COMMAND) {
        case 'get-feed':
            result = feed;
            break;
        case 'get-folders':
            result = feed.getFolders(FOLDERS);
            break;
        case 'prepare-posts':
            result = await feed.preparePosts({
                paths:FOLDERS, // err
                platforms:PLATFORMS // err
            });
            break;
        case 'schedule-next-posts':
            result = await feed.scheduleNextPosts(DATE ? new Date(DATE): undefined,{
                paths:FOLDERS, // err
                platforms:PLATFORMS // err
            });
            break;
        case 'publish-due-posts':
            result = await feed.publishDuePosts({
                paths:FOLDERS, // err
                platforms:PLATFORMS // err
            }, DRY_RUN);
            break;
        default: 
            const cmd = process.argv[1];
            console.log(`
${cmd} help 
${cmd} get-feed [--config=xxx]
${cmd} get-folders [--folders=xxx,xxx]
${cmd} prepare-posts [--platforms=xxx,xxx] [--folders=xxx,xxx]
${cmd} get-posts [--status=xxx] [--platforms=xxx,xxx] [--folders=xxx,xxx]
${cmd} schedule-next-post [--date=xxxx-xx-xx] [--platforms=xxx,xxx] [--folders=xxx,xxx]
${cmd} publish-due-posts [--platforms=xxx,xxx] [--folders=xxx,xxx] [--dry-run]
            `);

    }
    console.log(JSON.stringify(result,null,'\t'));


}

main();