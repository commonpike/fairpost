
import Ayrshare from "./Ayrshare";
import { PlatformSlug } from ".";
import Folder from "../Folder";
import Post from "../Post";

export default class AsYouTube extends Ayrshare {
    slug = PlatformSlug.ASYOUTUBE;

    constructor() {
        super();
    }

    async preparePost(folder: Folder): Promise<Post | undefined> {
        const post = await super.preparePost(folder);
        if (post) {
            // youtube: only 1 video
            post.files.image = [];
            if (post.files.video.length>1) {
                post.files.video.length=1;
            }
            if (!post.files.video.length) {
                post.valid = false;
            }
            post.save();
        }
        return post;
    }

    async publishPost(post: Post, dryrun:boolean = false): Promise<boolean> {
        return super.publishPost(post,{
            youTubeOptions: {
                title: post.title, // required max 100
                visibility: "public" // optional def private
            }, 
        },dryrun);
    }

}