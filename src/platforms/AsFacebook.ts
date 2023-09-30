
import Ayrshare from "./Ayrshare";
import { PlatformSlug } from ".";
import Folder from "../classes/Folder";
import Post from "../classes/Post";
import * as fs from 'fs';
import * as sharp from 'sharp';

export default class AsFacebook extends Ayrshare {
    slug: PlatformSlug = PlatformSlug.ASFACEBOOK;

    constructor() {
        super();
    }

    async preparePost(folder: Folder): Promise<Post | undefined> {
        const post = await super.preparePost(folder);
        if (post) {
            // facebook : max 10mb images
            for (const image of post.files.image) {
                var size = fs.statSync(post.folder.path+'/'+image).size / (1024*1024);
                if (size>=10) {
                    console.log('Resizing '+image+' for facebook ..');
                    await sharp(post.folder.path+'/'+image).resize({ 
                        width: 1200 
                    }).toFile(post.folder.path+'/_facebook-'+image);
                    post.files.image.push('_facebook-'+image);
                    post.files.image = post.files.image.filter(file => file !== image);
                } 
            }
            post.save();
        }
        return post;
    }

    async publishPost(post: Post, dryrun:boolean = false): Promise<boolean> {
        return super.publishPost(post,{},dryrun);
    }

}