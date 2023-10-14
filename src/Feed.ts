
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import Logger from './Logger';
import Platform from "./Platform";
import Folder from "./Folder";
import Post from "./Post";
import { PostStatus } from "./Post";
import * as platforms from './platforms';
import { PlatformId } from './platforms';

export default class Feed {

    path: string = '';
    platforms: {
        [id in PlatformId]? : Platform;
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

        const activePlatformIds = process.env.FAIRPOST_FEED_PLATFORMS.split(',');
        const platformClasses = fs.readdirSync(path.resolve(__dirname+'/platforms'));
        platformClasses.forEach(file=> {
            const constructor = file.replace('.ts','').replace('.js','');
            // nb import * as platforms loaded the constructors
            if (platforms[constructor] !== undefined) {
                const platform = new platforms[constructor]();
                platform.active = activePlatformIds.includes(platform.id);
                if (platform.active) {
                    this.platforms[platform.id] = platform;
                }
            }
        });
    }

    getPlatform(platformId:PlatformId): Platform {
        Logger.trace('Feed','getPlatform',platformId);
        return this.getPlatforms([platformId])[0];
    }

    getPlatforms(platformIds?:PlatformId[]): Platform[] {
        Logger.trace('Feed','getPlatforms',platformIds);
        return platformIds?.map(platformId=>this.platforms[platformId]) ?? Object.values(this.platforms);
    }

    async testPlatform(platformId:PlatformId): Promise<{}> {
        Logger.trace('Feed','testPlatform',platformId);
        const results = await this.testPlatforms([platformId]);
        return results[platformId];
    }

    async testPlatforms(platformsIds?:PlatformId[]): Promise<{ [id:string] : {}}> {
        Logger.trace('Feed','testPlatforms',platformsIds);
        const results = {};
        for (const platform of this.getPlatforms(platformsIds)) {
            results[platform.id] = await platform.test();
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

    getFolder(path: string): Folder | undefined {
        Logger.trace('Feed','getFolder',path);
        return this.getFolders([path])[0];
    }

    getFolders(paths?: string[]): Folder[] {
        Logger.trace('Feed','getFolders',paths);
        return paths?.map(path=>new Folder(this.path+'/'+path)) ?? this.getAllFolders();
    }

    getPost(path: string, platformId: PlatformId): Post | undefined {
        Logger.trace('Feed','getPost');
        return this.getPosts({paths:[path],platforms:[platformId]})[0];
    }

    getPosts(filters?: {
        paths?:string[]
        platforms?:PlatformId[], 
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

    async preparePost(path: string, platformId: PlatformId): Promise<Post | undefined> {
        Logger.trace('Feed','preparePost',path,platformId);
        return (await this.preparePosts({paths:[path],platforms:[platformId]}))[0];
    }

    async preparePosts(filters?: {
        paths?:string[]
        platforms?:PlatformId[]
    }): Promise<Post[]> {
        Logger.trace('Feed','preparePosts',filters);
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

    schedulePost(path: string, platformId: PlatformId, date: Date): Post {
        Logger.trace('Feed','schedulePost',path,platformId,date);
        const post = this.getPost(path,platformId);
        if (!post.valid) {
            throw new Error('Post is not valid');
        }
        if (post.status!==PostStatus.UNSCHEDULED) {
            throw new Error('Post is not unscheduled');
        }
        post.schedule(date);
        return post;
    }

    schedulePosts(filters: {
        paths?:string[]
        platforms?:PlatformId[]
    }, date: Date): Post[] {
        Logger.trace('Feed','schedulePosts',filters,date);
        const posts: Post[] = [];
        const platforms = this.getPlatforms(filters?.platforms);
        const folders = this.getFolders(filters?.paths);
        for (const platform of platforms) {
            for (const folder of folders) {
                const post = platform.getPost(folder);
                if (!post.valid) {
                    throw new Error('Post is not valid');
                }
                if (post.status!==PostStatus.UNSCHEDULED) {
                    throw new Error('Post is not unscheduled');
                }
                post.schedule(date);
                posts.push(post);
            }
        }
        return posts;
    }

    async publishPost(
        path:string,
        platformId:PlatformId,
        dryrun:boolean = false
    ): Promise<Post> {
        Logger.trace('Feed','publishPost',path,platformId,dryrun);
        const now = new Date();
        const platform = this.getPlatform(platformId);
        const folder = this.getFolder(path);
        const post = platform.getPost(folder);
        if (post.valid) {
            post.schedule(now);
            Logger.info('Posting',platformId,path);
            await platform.publishPost(post,dryrun);
        } else {
            throw new Error('Post is not valid');
        }
        return post;
    }

    async publishPosts(filters?: {
        paths?:string[]
        platforms?:PlatformId[]
    }, dryrun:boolean = false): Promise<Post[]> {
        Logger.trace('Feed','publishPosts',filters,dryrun);
        const now = new Date();
        const posts: Post[] = [];
        const platforms = this.getPlatforms(filters?.platforms);
        const folders = this.getFolders(filters?.paths);
        for (const platform of platforms) {
            for (const folder of folders) {
                const post = platform.getPost(folder);
                if (post.valid) {
                    post.schedule(now);
                    Logger.trace('Posting',platform.id,folder.path);
                    await platform.publishPost(post,dryrun);
                    posts.push(post);
                } else {
                    Logger.warn('Skipping invalid post',platform.id,folder.path);
                }
            }
        }
        return posts;
    }

    /*
        feed planning 
    */

    getLastPost(platformId:PlatformId): Post | void {
        Logger.trace('Feed','getLastPost');
        let lastPost: Post = undefined;
        const posts = this.getPosts({
            platforms: [platformId],
            status: PostStatus.PUBLISHED
        });
        for (const post of posts) {
            if (!lastPost || post.published >= lastPost.published) {
                lastPost = post;
            }
        }
        return lastPost;
    }
    
   
    getNextPostDate(platformId:PlatformId): Date {
        Logger.trace('Feed','getNextPostDate');
        let nextDate = null;
        const lastPost = this.getLastPost(platformId);
        if (lastPost) {
            nextDate = new Date(lastPost.published);
            nextDate.setDate(nextDate.getDate()+this.interval);
        } else {
            nextDate = new Date();
        }
        return nextDate;
    }

    scheduleNextPosts(date?: Date, filters?: {
        paths?:string[]
        platforms?:PlatformId[]
    }): Post[] {
        Logger.trace('Feed','scheduleNextPosts');
        const posts: Post[] = [];
        const platforms = this.getPlatforms(filters?.platforms);
        const folders = this.getFolders(filters?.paths);
        for (const platform of platforms) {
            const nextDate = date?date:this.getNextPostDate(platform.id);
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
        platforms?:PlatformId[]
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
                        console.log('Posting',platform.id,folder.path);
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