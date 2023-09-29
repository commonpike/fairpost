
import Ayrshare from "./Ayrshare";
import { PlatformSlug } from ".";
import Folder from "../classes/Folder";
import Post from "../classes/Post";

export default class AsTwitter extends Ayrshare {
    slug = PlatformSlug.ASTWITTER;

    constructor() {
        super();
    }

    async preparePost(folder: Folder): Promise<Post | undefined> {
        const post = await super.preparePost(folder);
        if (post) {
            // twitter: no video
            post.files.video = [];
            // twitter: max 4 images 
            if (post.files.image.length>4) {
                post.files.image.length=4;
            }
            post.save();
        }
        return post;
    }

    async publishPost(post: Post, dryrun:boolean = false): Promise<boolean> {
        return super.publishPost(post,{},dryrun);
    }

}