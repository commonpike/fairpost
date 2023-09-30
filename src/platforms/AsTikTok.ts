
import Ayrshare from "./Ayrshare";
import { PlatformSlug } from ".";
import Folder from "../Folder";
import Post from "../Post";

export default class AsTikTok extends Ayrshare {
    slug = PlatformSlug.ASTIKTOK;

    constructor() {
        super();
    }

    async preparePost(folder: Folder): Promise<Post | undefined> {
        const post = await super.preparePost(folder);
        if (post) {
            // tiktok: one video
            post.files.image = [];
            if (!post.files.video.length) {
                post.valid = false;
            } else {
                post.files.video.length = 1;
            }
            post.save();
        }
        return post;
    }

    async publishPost(post: Post, dryrun:boolean = false): Promise<boolean> {
        return super.publishPost(post,{},dryrun);
    }
}