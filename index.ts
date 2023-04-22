/*
    Usage

    node index.js 
        --dry-run
        --debug
        --platforms=x[,y,..]|all 
        --date=yyyy-mm-dd|now
        --posts=dir1[,dir2,..]
        --max=x
        --interval=7
        --types=[text,images,video]|auto

*/

import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv' 
dotenv.config()

// constants
const APP_TITLE = 'Ayrshare feed';
const APIKEY = process.env.AYRSHARE_API_KEY;
const FEED_PATH = process.env.AYRSHARE_FEEDPATH;
const SUPPORTED_PLATFORMS = process.env.AYRSHARE_PLATFORMS?.split(',')??[];
const REDDIT_SUBREDDIT = process.env.AYRSHARE_SUBREDDIT;

// arguments
const DRY_RUN = !!getArgument('dry-run') ?? false;
const DEBUG = !!getArgument('debug') ?? false;
const REQUESTED_PLATFORMS = (getArgument('platforms') as string)?.split(',') ?? SUPPORTED_PLATFORMS;
const POST_DIRS = (getArgument('posts') as string)?.split(',') ?? [];
const POST_MAX = getArgument('max')?Number(getArgument('max')):0;
const FIRST_POSTDATE = getArgument('date')?new Date(getArgument('date') as string):null;
const POSTDATE_INTERVAL = getArgument('interval')?Number(getArgument('interval')):Number(process.env.AYRSHARE_INTERVAL);
const REQUESTED_TYPES = (getArgument('types') as string)?.split(',') ?? ['text','image','video'];

// interfaces
interface PostResult {
    dryrun?: boolean;
    status: string;
    error?: Error;
    media: string[];
    platforms: string[];
}

interface PostData {
    type: 'image'|'video'|'text';
    platforms : string[];
    title: string;
    body : string;
    images : string[];
    videos : string[];
    media : {
        [platform: string]: string[];
    };
    scheduled : Date;
    posted : Date;
    pending: boolean;
    results : {
        [platform: string]: PostResult;
    };
}

// Classes

class Post {

    static defBody = "#Ayrshare feed";
    static postFile = 'post.json';

    static requiresApproval = false;

    static dryRun = DRY_RUN;
    static debug = DEBUG;
    static supported = SUPPORTED_PLATFORMS;
    static postDateInterval = POSTDATE_INTERVAL; 

    static nextPostDate = new Date();
    static type2platforms = {
        video: ["facebook", "youtube","instagram","linkedin","tiktok"],
        image: ["twitter", "facebook", "instagram","linkedin","reddit"],
        text: ["twitter", "facebook","linkedin","reddit"]
    };

    
    path = '';
    data = undefined as PostData || undefined;

    constructor(path: string) {
        this.path = path;
        const files = this.getFiles();
        if (files.includes(Post.postFile)) {
            const data = JSON.parse(fs.readFileSync(this.path+'/'+Post.postFile, 'utf8'));
            if (data) {
                this.data = data;
                this.data.scheduled= data?.scheduled?new Date(data.scheduled):undefined;
                this.data.posted = data?.posted?new Date(data.posted):undefined;
            }
        }
        if (!this.data) {
            this.data = {
                type: 'text',
                platforms : [],
                title: '',
                body : '#Ayrshare feed',
                images : [],
                videos : [],
                media: {},
                scheduled : undefined,
                posted : undefined,
                pending: true,
                results : {}
            };
        }
        if (!this.data.media) {
            this.data.media = {};
        }
        try {
            this.data.body = fs.readFileSync(path+'/body.txt','utf8'); 
        } catch (e) {
            this.data.body = Post.defBody;
        }
        this.data.title = this.data.body.split('\n', 1)[0];
        // TBD config extensions
        this.data.images = files.filter(file=>["jpg","jpeg","png"].includes(file.split('.')?.pop()??''));
        this.data.videos = files.filter(file=>["mp4"].includes(file.split('.')?.pop()??''));
        // TBD throw errors for mixed types
        if (this.data.images.length) {
            this.data.type="image";
        } else if (this.data.videos.length) {
            this.data.type="video";
        } else {
            this.data.type="text";
        }

        this.data.platforms = Post.type2platforms[this.data.type]
            .filter(platform => Post.supported.includes(platform));

        this.write();
    }

    write() {
        if (Post.debug) {
            console.log(this.getJson());
        }
        if (!Post.dryRun) {
            fs.writeFileSync(this.path+'/'+Post.postFile,this.getJson());
        } 
    }
    getJson() {
        return JSON.stringify(this.data,null,"\t");
    }

    getFiles(): string[] {
        return fs.readdirSync(this.path).filter(file => {
            return !file.startsWith('_') && fs.statSync(this.path+'/'+file).isFile();
        });
    }

    async process(requestedPlatforms?: string[]) {
        const processedPlatforms = Object.values(this.data.results)
            .filter(r=>r.status==='success').flatMap(r=>r.platforms);
        const pendingPlatforms = this.data.platforms
            .filter(platform => !processedPlatforms.includes(platform));
        const processPlatforms = requestedPlatforms ? 
            pendingPlatforms.filter(
                platform => requestedPlatforms.includes(platform)
            ): pendingPlatforms;
        if (processPlatforms.length) {
            console.log('+ scheduling post '+this.path,Post.nextPostDate,processPlatforms);
            await this.schedule(processPlatforms);
        } else {
            console.log('v post '+this.path+' already scheduled at '+this.data.scheduled);
        }
    }

    async schedule(platforms: string[]) {
        
        this.data.scheduled = new Date(Post.nextPostDate);
        
        switch (this.data.type) {
            case "image":
                await this.prepareImagePost(platforms);
                break;
            case "video":
                await this.prepareVideoPost(platforms);
                break;
            default:
                await this.prepareTextPost(platforms);
        }

        const results = await this.ayrshare(platforms);
        
        if (Object.values(results).map(r=>r.status).includes('success')) {
            this.data.posted=new Date();
            Post.nextPostDate.setDate(Post.nextPostDate.getDate()+Post.postDateInterval);
        } else {
            this.data.posted=undefined;
            this.data.scheduled=undefined;
            if (Post.dryRun) {
                Post.nextPostDate.setDate(Post.nextPostDate.getDate()+Post.postDateInterval);
            }
        }
        if (Object.values(results).every(r=>r.status==='success')) {
            this.data.pending=false;
        }
        
        for (const platform in results) {
            this.data.results[platform] = results[platform];
        }

        this.write();
    }

    async prepareTextPost(platforms: string[]) {
        return;
    }
    
    async prepareVideoPost(platforms: string[]) {

        const media = await this.uploadMedia(this.data.videos); 

        // linkedin: max 9 media
        if (platforms.includes('linkedin') && media.length>9) {
            this.data.media['linkedin'] = media.slice(0, 9);
        }
        // reddit: max 1 media
        if (platforms.includes('reddit') && media.length>1) {
            this.data.media['reddit'] = media.slice(0, 1);
        } 
        // tiktok: max len 60s
        // ... 
        // rest
        this.data.media['default']=media;

    }

    async prepareImagePost(platforms: string[]) {
        
        // insta: max 1440 wide
        if (platforms.includes('instagram')) {
            const originalImages = this.data.images;
            const resizedImages = [] as string[];
            let haveResized=false;
            for (const image of originalImages) {
                const metadata = await sharp(this.path+'/'+image).metadata();
                if (metadata.width > 1440) {
                    console.log('Resizing '+image+' for instagram ..');
                    await sharp(this.path+'/'+image).resize({ width: 1440 }).toFile(this.path+'/_instagram-'+image);
                    resizedImages.push('_instagram-'+image);
                    haveResized=true;
                } else {
                    resizedImages.push(image);
                }
            }
            if (haveResized) {
                this.data.media['instagram'] = await this.uploadMedia(resizedImages); 
            }
        }
        const media = await this.uploadMedia(this.data.images); 
        
        // twitter: max 4 media
        if (platforms.includes('twitter') && media.length>4) {
            this.data.media['twitter'] = media.slice(0, 4);
        } 
        // linkedin: max 9 media
        if (platforms.includes('linkedin') && media.length>9) {
            this.data.media['linkedin'] = media.slice(0, 9);
        } 
        // reddit: max 1 media
        if (platforms.includes('reddit') && media.length>1) {
            this.data.media['reddit'] = media.slice(0, 1);
        } 
        // rest
        this.data.media['default']=media;

    }

    

    async uploadMedia(media: string[]): Promise<string[]> {
        const urls= [] as string[];
        for (const file of media) {
            const buffer = fs.readFileSync(this.path+'/'+file); 
            const ext = path.extname(file);
            const basename = path.basename(file, ext);
            const uname = basename+'-'+randomUUID()+ext;
            const res1 = await fetch("https://app.ayrshare.com/api/media/uploadUrl?fileName="+uname+"&contentType="+ext.substring(1), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${APIKEY}`
                }
            });

            if (!res1) {
                return [];
            }

            const data = await res1.json();
            //console.log(data);
            console.log('uploading..',uname);
            const uploadUrl = data.uploadUrl;
            const contentType = data.contentType;
            const accessUrl = data.accessUrl;
            
            const res2 = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                    "Content-Type": contentType,
                    "Authorization": `Bearer ${APIKEY}`
                },
                body: buffer,
            });

            if (!res2) {
                return [];
            }
            
            urls.push(accessUrl.replace(/ /g, '%20'));

        }
        return urls;
    }

    async ayrshare(platforms: string[]): Promise<{
        [platform:string] : PostResult
    }> {
        
        if (!platforms.length) {
            return {};
        }
        const result = {} as {
            [platform:string] : PostResult
        };
        const mediaPlatforms = Object.keys(this.data.media);
        
        for (const mediaPlatform in this.data.media) {

            const media = this.data.media[mediaPlatform];
            
            const postPlatforms = mediaPlatform==='default'?
                platforms.filter(p=>!mediaPlatforms.includes[p]):[mediaPlatform]; 
            
            if (Post.dryRun) {
                result[mediaPlatform] = {
                    dryrun:true,
                    status: 'dryrun',
                    platforms:postPlatforms,
                    media:media
                };
            } else {
                const res = await fetch("https://app.ayrshare.com/api/post", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${APIKEY}`
                    },
                    body: JSON.stringify(media.length?{
                            post: this.data.body, // required
                            platforms: postPlatforms, // required
                            mediaUrls: media, 
                            scheduleDate: this.data.scheduled,
                            requiresApproval: Post.requiresApproval,
                            isVideo: (this.data.type==='video'),
                            youTubeOptions: {
                                title: this.data.title, // required max 100
                                visibility: "public" // optional def private
                            }, 
                            instagramOptions: {
                                // "autoResize": true -- only enterprise plans
                            },
                            redditOptions: {
                                title: this.data.title, // required 
                                subreddit: REDDIT_SUBREDDIT,   // required (no "/r/" needed)
                            } 
                        }:{
                            post: this.data.body, // required
                            platforms: this.data.platforms, // required
                            scheduleDate: this.data.scheduled,
                            requiresApproval: Post.requiresApproval
                        }
                    )
                }).catch(e=> {
                    console.error(e);
                    result[mediaPlatform]={
                        dryrun:false,
                        status: 'error',
                        error: e,
                        platforms: platforms,
                        media:media
                    };
                });
                if (res) {
                    result[mediaPlatform] = res.json()  as unknown as PostResult;
                    if (result[mediaPlatform]['status']==='error') {
                        console.error(result);
                    } 
                    result[mediaPlatform]['dryrun'] = false;
                    result[mediaPlatform]['platforms'] = platforms;
                    result[mediaPlatform]['media'] = media;
                }
            }
        }
        return result;
    }
}

class Feed {
    path = '';
    constructor(path: string) {
        this.path = path;
    }
    getDirectories(path: string): string[] {
        return fs.readdirSync(path).filter(function (file) {
            return !file.startsWith('_') && fs.statSync(path+'/'+file).isDirectory();
        });
    }
    getPosts(): Post[] {
        const posts = [] as Post[];
        this.getDirectories(this.path).forEach(postDir=> {
            const post = new Post(this.path+'/'+postDir);
            posts.push(post);
        });
        return posts;
    }
    getPendingPosts(): Post[] {
        return this.getPosts().filter(p=>p.data.pending);
    }
    getNextPostDate(): Date {
        const today = new Date();
        let lastPostDate = new Date('1970-01-01');

        this.getPosts().forEach(post=>{
            if (post.data.scheduled && post.data.scheduled>lastPostDate) {
                //console.log(post.scheduled,lastPostDate);
                lastPostDate = new Date(post.data.scheduled);
            }
        });
        const nextPostDate = new Date(lastPostDate);
        nextPostDate.setDate(nextPostDate.getDate()+Post.postDateInterval);

        console.log('Last post date',lastPostDate);
        console.log('Next post date',Post.nextPostDate);

        if (nextPostDate<today) {
            return today;
        } 
        return nextPostDate;
        
    }
}

// utilities

function getArgument(key:string):boolean|string|null {
    if ( process.argv.includes( `--${ key }` ) ) return true;
    const value = process.argv.find( element => element.startsWith( `--${ key }=` ) );
    if ( !value ) return null;
    return value.replace( `--${ key }=` , '' );
}



/* main */
async function main() {

    console.log(APP_TITLE+' starting .. ',Post.dryRun?'dry-run':'');
    console.log();

    if (!fs.existsSync(FEED_PATH)) {
        fs.mkdirSync(FEED_PATH);
    }

    let posts = [] as Post[];
    if (!POST_DIRS.length) {
        const feed = new Feed(FEED_PATH);
        posts = feed.getPendingPosts();
        if (FIRST_POSTDATE) {
            Post.nextPostDate = FIRST_POSTDATE;
        } else {
            Post.nextPostDate = feed.getNextPostDate();
        }
    } else {
        posts = POST_DIRS.map(d=>new Post(d));
        if (FIRST_POSTDATE) {
            Post.nextPostDate = FIRST_POSTDATE;
        } else {
            Post.nextPostDate = new Date();
        }
    }

    if (POST_MAX) {
        posts = posts.slice(0,POST_MAX);
    }

    console.log();
    for (const post of posts) {
        console.log('Found',post.path,post.data.type,'...');
    }

    for (const post of posts) {
        console.log();
        if (REQUESTED_TYPES.includes(post.data.type)) {
            console.log('Processing',post.path,post.data.type,'...');
            await post.process(REQUESTED_PLATFORMS);
        } else {
            console.log('Skipping',post.path,post.data.type,'...');
        }
        console.log();
    }

    console.log();
    console.log(APP_TITLE+' All done',Post.dryRun?' (dry-run).':'.');

}

main();