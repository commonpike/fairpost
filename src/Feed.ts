
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import Logger from './Logger';
import Platform from "./Platform";
import Folder from "./Folder";
import Post from "./Post";
import { PostStatus } from "./Post";
import * as platforms from './platforms';
import { PlatformSlug } from './platforms';

export default class Feed {

    path: string = '';
    platforms: {
        [slug in PlatformSlug]? : Platform;
    } = {};
    folders: Folder[] = [];
    interval: number;

    constructor(configPath?: string) {
        if (configPath) {
            const configPathResolved = path.resolve(__dirname+'/../../'+configPath);
            dotenv.config({ path:configPathResolved });
        } else {
            dotenv.config();
        }
        if (process.env.FAIRPOST_FEED_PATH) {
            this.path = process.env.FAIRPOST_FEED_PATH;
        } else {
            throw new Error('Problem reading .env config file');
        }
        this.interval = Number(process.env.FAIRPOST_FEED_INTERVAL ?? 7);

        const activePlatformSlugs = process.env.FAIRPOST_FEED_PLATFORMS.split(',');
        const platformClasses = fs.readdirSync(path.resolve(__dirname+'/platforms'));
        platformClasses.forEach(file=> {
            const constructor = file.replace('.ts','').replace('.js','');
            // nb import * as platforms loaded the constructors
            if (platforms[constructor] !== undefined) {
                const platform = new platforms[constructor]();
                platform.active = activePlatformSlugs.includes(platform.slug);
                if (platform.active) {
                    this.platforms[platform.slug] = platform;
                }
            }
        });
    }

    getPlatforms(platforms?:PlatformSlug[]): Platform[] {
        Logger.trace('Feed','getPlatforms',platforms);
        return platforms?.map(platform=>this.platforms[platform]) ?? Object.values(this.platforms);
    }

    async testPlatforms(platforms?:PlatformSlug[]): Promise<{ [slug:string] : {}}> {
        const results = {};
        for (const platform of this.getPlatforms(platforms)) {
            results[platform.slug] = await platform.test();
        }
        return results;
    }

    getAllFolders(): Folder[] {
        Logger.trace('Feed','getAllFolders');
        if (this.folders.length) {
            return this.folders;
        }
        if (!fs.existsSync(this.path)) {
            fs.mkdirSync(this.path);
        }
        const paths = fs.readdirSync(this.path).filter(path => {
            return  fs.statSync(this.path+'/'+path).isDirectory() && 
            !path.startsWith('_') && !path.startsWith('.');
        });
        if (paths) {
            this.folders = paths.map(path => new Folder(this.path+'/'+path));
        }
        return this.folders;
    }

    getFolders(paths?: string[]): Folder[] {
        Logger.trace('Feed','getFolders');
        return paths?.map(path=>new Folder(this.path+'/'+path)) ?? this.getAllFolders();
    }

    getPosts(filters?: {
        paths?:string[]
        platforms?:PlatformSlug[], 
        status?:PostStatus
    }): Post[] {
        Logger.trace('Feed','getPosts');
        const posts: Post[] = [];
        const platforms = this.getPlatforms(filters?.platforms);
        const folders = this.getFolders(filters?.paths);
        for (const folder of folders) {
            for (const platform of platforms) {
                const post = platform.getPost(folder);
                if (post && (!filters?.status || filters.status.includes(post.status))) {
                    posts.push(post);
                }
            }
        }
        return posts;
    }

    async preparePosts(filters?: {
        paths?:string[]
        platforms?:PlatformSlug[]
    }): Promise<Post[]> {
        Logger.trace('Feed','preparePosts');
        const posts: Post[] = [];
        const platforms = this.getPlatforms(filters?.platforms);
        const folders = this.getFolders(filters?.paths);
        for (const folder of folders) {
            for (const platform of platforms) {
                const post = platform.getPost(folder);
                if (post?.status!==PostStatus.PUBLISHED) {
                    const newPost = await platform.preparePost(folder);
                    if (newPost) {
                        posts.push(newPost);
                    }
                }
            }
        }
        return posts;
    }

    
    getLastPost(platform:PlatformSlug): Post | void {
        Logger.trace('Feed','getLastPost');
        let lastPost: Post = undefined;
        const posts = this.getPosts({
            platforms: [platform],
            status: PostStatus.PUBLISHED
        });
        for (const post of posts) {
            if (!lastPost || post.posted >= lastPost.posted) {
                lastPost = post;
            }
        }
        return lastPost;
    }
    
   
    getNextPostDate(platform:PlatformSlug): Date {
        Logger.trace('Feed','getNextPostDate');
        let nextDate = null;
        const lastPost = this.getLastPost(platform);
        if (lastPost) {
            nextDate = new Date(lastPost.posted);
            nextDate.setDate(nextDate.getDate()+this.interval);
        } else {
            nextDate = new Date();
        }
        return nextDate;
    }

    scheduleNextPosts(date?: Date, filters?: {
        paths?:string[]
        platforms?:PlatformSlug[]
    }): Post[] {
        Logger.trace('Feed','scheduleNextPosts');
        const posts: Post[] = [];
        const platforms = this.getPlatforms(filters?.platforms);
        const folders = this.getFolders(filters?.paths);
        for (const platform of platforms) {
            const nextDate = date?date:this.getNextPostDate(platform.slug);
            for (const folder of folders) {
                const post = platform.getPost(folder);
                if (post.valid && post?.status===PostStatus.UNSCHEDULED) {
                    post.schedule(nextDate);
                    posts.push(post);
                    break;
                }
                
            }
        }
        return posts;
    }

    async publishDuePosts(filters?: {
        paths?:string[]
        platforms?:PlatformSlug[]
    }, dryrun:boolean = false): Promise<Post[]> {
        Logger.trace('Feed','publishDuePosts');
        const now = new Date();
        const posts: Post[] = [];
        const platforms = this.getPlatforms(filters?.platforms);
        const folders = this.getFolders(filters?.paths);
        for (const platform of platforms) {
            for (const folder of folders) {
                const post = platform.getPost(folder);
                if (post?.status===PostStatus.SCHEDULED) {
                    if (post.scheduled <= now) {
                        console.log('Posting',platform.slug,folder.path);
                        await platform.publishPost(post,dryrun);
                        posts.push(post);
                        break;
                    }
                }
            }
        }
        return posts;
    }

    
}