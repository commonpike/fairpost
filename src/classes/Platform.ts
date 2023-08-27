import * as fs from 'fs';
import * as path from 'path';
import Folder from "./Folder";
import Post from "../interfaces/Post";
import { PlatformSlug, PostStatus, blankPost } from "../interfaces/Post";



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
            return JSON.parse(fs.readFileSync(folder.path+'/'+this.getPostFileName(), 'utf8'));
        }
        return;
    }

    /*
    * savePost
    *
    * Save the given post for this platform for the
    * given folder.
    */

    savePost(folder: Folder, post: Post): void {
        fs.writeFileSync(folder.path+'/'+this.getPostFileName(),JSON.stringify(post,null,"\t"));
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
        const post = this.getPost(folder) ?? blankPost;
        if (post.status===PostStatus.PUBLISHED) {
            return;
        }
        if (post.status===PostStatus.FAILED) {
            post.status=PostStatus.UNSCHEDULED;
        }
        post.path = folder.path;
        post.platform = this.slug;
        
        // some default logic. override this 
        // in your own platform if you need.

        post.files = folder.getFiles();
        
        if (post.files.text?.includes('body.txt')) {
            post.body = fs.readFileSync(post.path+'/body.txt','utf8'); 
        } else {
            post.body = this.defaultBody; 
        }
        
        if (post.files.text?.includes('title.txt')) {
            post.title = fs.readFileSync(post.path+'/title.txt','utf8'); 
        } else {
            post.title = post.body.split('\n', 1)[0];
        }

        if (post.files.text?.includes('tags.txt')) {
            post.tags = fs.readFileSync(post.path+'/tags.txt','utf8'); 
        } 

        this.savePost(folder,post);
        return post;
    }

    // schedulePost()

    // publishPost()
}


