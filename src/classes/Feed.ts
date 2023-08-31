
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import Platform from "./Platform";
import Folder from "./Folder";
import Post from "./Post";
import { PostStatus } from "./Post";
import * as platforms from '../platforms';
import { PlatformSlug } from '../platforms';

export default class Feed {

    path: string = '';
    platforms: Platform[] = [];
    folders: Folder[] = [];
    interval: number;

    constructor(configPath?: string) {
        if (configPath) {
            const configPathResolved = path.resolve(__dirname+'/../../../'+configPath);
            dotenv.config({ path:configPathResolved });
        } else {
            dotenv.config();
        }
        if (process.env.FAYRSHARE_FEED_PATH) {
            this.path = process.env.FAYRSHARE_FEED_PATH;
        } else {
            throw new Error('Problem reading .env config file');
        }
        const platformClasses = fs.readdirSync(path.resolve(__dirname+'/../platforms'));
        platformClasses.forEach(file=> {
            const constructor = file.replace('.ts','').replace('.js','');
            if (platforms[constructor] !== undefined) {
                this.platforms.push(new platforms[constructor]());
            }
        });
        this.interval = Number(process.env.FAYRSHARE_FEED_INTERVAL);

    }

    getPlatforms(): Platform[] {
        return this.platforms;
    }

    getAllFolders(): Folder[] {
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
        if (!paths) {
            return this.getAllFolders();
        } 
        return paths.map(path=>new Folder(this.path+'/'+path));
    }

    getPosts(filters?: {
        paths?:[string], 
        platforms?:[PlatformSlug], 
        status?:[PostStatus]
    }): Post[] {
        const posts: Post[] = [];
        const platforms = filters?.platforms?.map(platform=>this.platforms[platform]) ?? this.platforms;
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
        paths?:[string], 
        platforms?:[PlatformSlug]
    }): Promise<Post[]> {
        
        const posts: Post[] = [];
        const platforms = filters?.platforms?.map(platform=>this.platforms[platform]) ?? this.platforms;
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
        let lastPost: Post = undefined;
        const posts = this.getPosts({
            platforms: [platform],
            status: [PostStatus.PUBLISHED]
        });
        for (const post of posts) {
            if (!lastPost || post.posted >= lastPost.posted) {
                lastPost = post;
            }
        }
        return lastPost;
    }
    
   
    getNextPostDate(platform:PlatformSlug): Date {
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
        paths?:[string], 
        platforms?:[PlatformSlug]
    }): Post[] {
        const posts: Post[] = [];
        const platforms = filters?.platforms?.map(platform=>this.platforms[platform]) ?? this.platforms;
        const folders = this.getFolders(filters?.paths);
        for (const platform of platforms) {
            const nextDate = date?date:this.getNextPostDate(platform);
            for (const folder of folders) {
                const post = platform.getPost(folder);
                if (post?.status===PostStatus.UNSCHEDULED) {
                    post.schedule(nextDate);
                    posts.push(post);
                    break;
                }
            }
        }
        return posts;
    }

    async publishDuePosts(filters?: {
        paths?:[string], 
        platforms?:[PlatformSlug]
    }, dryrun:boolean = false): Promise<Post[]> {
        const now = new Date();
        const posts: Post[] = [];
        const platforms = filters?.platforms?.map(platform=>this.platforms[platform]) ?? this.platforms;
        const folders = this.getFolders(filters?.paths);
        for (const folder of folders) {
            for (const platform of platforms) {
                const post = platform.getPost(folder);
                if (post?.status===PostStatus.SCHEDULED) {
                    if (post.scheduled <= now) {
                        await platform.publish(post,dryrun);
                        posts.push(post);
                        break;
                    }
                }
            }
        }
        return posts;
    }

    
}