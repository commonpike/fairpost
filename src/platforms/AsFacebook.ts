
import Ayrshare from "./Ayrshare";
import { PlatformSlug } from ".";
import Folder from "../classes/Folder";
import Post from "../classes/Post";

export default class AsFacebook extends Ayrshare {
    slug: PlatformSlug = PlatformSlug.ASFACEBOOK;

    async preparePost(folder: Folder): Promise<Post | undefined> {
        return super.preparePost(folder);
    }

    async publishPost(post: Post, dryrun:boolean = false): Promise<boolean> {
        return super.publishPost(post,{},dryrun);
    }

}