
import Ayrshare from "./Ayrshare";
import { PlatformSlug } from ".";
import Folder from "../classes/Folder";
import Post from "../classes/Post";

export default class AsLinkedIn extends Ayrshare {
    slug = PlatformSlug.ASLINKEDIN;

    constructor() {
        super();
    }

    async preparePost(folder: Folder): Promise<Post | undefined> {
        const post = await super.preparePost(folder);
        if (post) {
            // linkedin: max 9 media
            if (post.files.video.length > 9) {
                post.files.video.length = 9;
            }
            if (post.files.image.length + post.files.video.length > 9 ) {
                post.files.image.length = Math.max(0,post.files.image.length - post.files.video.length);
            } 
            post.save();
        }
        return post;
    }

    async publishPost(post: Post, dryrun:boolean = false): Promise<boolean> {
        return super.publishPost(post,{},dryrun);
    }
}