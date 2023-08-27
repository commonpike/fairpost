
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import Platform from "./Platform";
import Folder from "./Folder";
import Post from "../interfaces/Post";
import { PlatformSlug, PostStatus } from "../interfaces/Post";
import * as platforms from '../platforms';

export default class Feed {

    path: string = '';
    platforms: Platform[] = [];
    folders: Folder[] = [];

    constructor(configPath?: string) {
        const configPathResolved = path.resolve(__dirname+'/../../../'+configPath);
        dotenv.config({ path:configPathResolved });
        if (process.env.FAYRSHARE_FEED_PATH) {
            this.path = process.env.FAYRSHARE_FEED_PATH;
        } else {
            throw new Error('Bad config file :'+ configPathResolved);
        }
        const platformClasses = fs.readdirSync(path.resolve(__dirname+'/../platforms'));
        platformClasses.forEach(file=> {
            const constructor = file.replace('.ts','').replace('.js','');
            if (platforms[constructor] !== undefined) {
                this.platforms.push(new platforms[constructor]());
            }
        });
        

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

    getAllPosts(): Post[] {
        const posts: Post[] = [];
        this.getAllFolders().forEach(folder => {
            this.getPlatforms().forEach(platform => {
                const post = platform.getPost(folder);
                if (post) {
                    posts.push(post);
                }
            })
        });
        return posts;
    }

    getPosts(filters: {
        paths?:[string], 
        platforms?:[PlatformSlug], 
        status?:[PostStatus]
    }): Post[] {
        const posts: Post[] = [];
        this.getFolders(filters.paths).forEach(folder => {
            this.getPlatforms().forEach(platform => {
                if (!filters.platforms || filters.platforms.includes(platform.slug)) {
                    const post = platform.getPost(folder);
                    if (post && (!filters.status || filters.status.includes(post.status))) {
                        posts.push(post);
                    }
                }
            })
        });
        return posts;
    }

    preparePosts(filters: {
        paths?:[string], 
        platforms?:[PlatformSlug], 
        status?:[PostStatus]
    }): Post[] {
        
        const posts: Post[] = [];
        this.getFolders(filters.paths).forEach(folder => {
            this.getPlatforms().forEach(platform => {
                if (!filters.platforms || filters.platforms.includes(platform.slug)) {
                    const orgPost = platform.getPost(folder);
                    if (!orgPost || (!filters.status || filters.status.includes(orgPost.status))) {
                        const newPost = platform.preparePost(folder);
                        if (newPost) {
                            posts.push(newPost);
                        }
                    }
                }
            })
        });
        return posts;
    }

    // scheduleNextPosts()

    // publishDuePosts()

    
}