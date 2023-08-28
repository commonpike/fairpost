import * as fs from 'fs';
import * as path from 'path';
import Folder from "./Folder";
import Post from "./Post";
import { PostStatus } from "./Post";
import { PlatformSlug } from "../platforms";



export default class Platform {

    slug: PlatformSlug = PlatformSlug.UNKNOWN;
    defaultBody = "Fayrshare feed";

    /*
    * getPostFileName
    *
    * Return the intended name for a post of this
    * platform to be saved in this folder.
    */
    getPostFileName() {
        return '_'+this.slug+'.json';
    }

    /*
    * getPost
    *
    * Return the post for this platform for the
    * given folder, if it exists.
    */

    getPost(folder: Folder): Post | undefined {
        if (fs.existsSync(folder.path+'/'+this.getPostFileName())) {
            const data = JSON.parse(fs.readFileSync(folder.path+'/'+this.getPostFileName(), 'utf8'));
            if (data) {
                return new Post(folder,this,data);
            }
        }
        return;
    }

    /*
    * preparePost
    *
    * Prepare the post for this platform for the
    * given folder, and save it. Optionally create
    * derivates of media and save those, too.
    * 
    * If the post exists and is published, ignore.
    * If the post exists and is failed, set it back to 
    * unscheduled.
    */
    preparePost(folder: Folder): Post | undefined {
        
        const post = this.getPost(folder) ?? new Post(folder,this);
        if (post.status===PostStatus.PUBLISHED) {
            return;
        }
        if (post.status===PostStatus.FAILED) {
            post.status=PostStatus.UNSCHEDULED;
        }
        
        // some default logic. override this 
        // in your own platform if you need.

        post.files = folder.getFiles();
        
        if (post.files.text?.includes('body.txt')) {
            post.body = fs.readFileSync(post.folder.path+'/body.txt','utf8'); 
        } else {
            post.body = this.defaultBody; 
        }
        
        if (post.files.text?.includes('title.txt')) {
            post.title = fs.readFileSync(post.folder.path+'/title.txt','utf8'); 
        } else {
            post.title = post.body.split('\n', 1)[0];
        }

        if (post.files.text?.includes('tags.txt')) {
            post.tags = fs.readFileSync(post.folder.path+'/tags.txt','utf8'); 
        } 

        post.save();
        return post;
    }

    /*
    * publishPost
    *
    * publish the post for this platform, sync. 
    * set the posted date to now.
    * add the result to post.results
    * on success, set the status to published and return true,
    * else set the status to failed and return false
    */

    publishPost(post: Post, dryrun:boolean = false): boolean {
        post.posted = new Date();
        post.results.push({
            error: 'publishing not implemented for '+this.slug
        });
        post.status = PostStatus.FAILED;
        return false;
    }
}


