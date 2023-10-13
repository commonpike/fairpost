import Logger from '../Logger';
import Ayrshare from "./Ayrshare";
import { PlatformSlug } from ".";
import Folder from "../Folder";
import Post from "../Post";

export default class AsReddit extends Ayrshare {
    slug = PlatformSlug.ASREDDIT;
    SUBREDDIT: string;

    constructor() {
        super();
        this.SUBREDDIT = process.env.FAIRPOST_REDDIT_SUBREDDIT;
    }
    

    async preparePost(folder: Folder): Promise<Post | undefined> {
        const post = await super.preparePost(folder);
        if (post) {
            // reddit: max 1 image, no video
            post.files.video = [];
            if (post.files.image.length > 1 ) {
                post.files.image.length = 1;
            } 
            post.save();
        }
        return post;
    }

    async publishPost(post: Post, dryrun:boolean = false): Promise<boolean> {
        return super.publishPost(post,{
            redditOptions: {
                title: post.title, // required 
                subreddit: this.SUBREDDIT,   // required (no "/r/" needed)
            } 
        },dryrun);
    }

}