
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PlatformSlug } from ".";
import Platform from "../classes/Platform";
import Folder from "../classes/Folder";
import Post from "../classes/Post";

interface AyrshareResult {
    success: boolean;
    error?: Error;
    response: {}
}

export default abstract class Ayrshare extends Platform {

    APIKEY: string;

    requiresApproval: boolean = false;

    platforms: {
        [slug in PlatformSlug]?: string
    } = {
        [PlatformSlug.ASYOUTUBE]: "youtube",
        [PlatformSlug.ASINSTAGRAM]: "instagram",
        [PlatformSlug.ASFACEBOOK]: "facebook",
        [PlatformSlug.ASTWITTER]: "twitter",
        [PlatformSlug.ASTIKTOK]: "tiktok",
        [PlatformSlug.ASLINKEDIN]: "linkedin",
        [PlatformSlug.ASREDDIT]: "reddit"
    };

    constructor() {
        super();
        this.active = process.env.FAYRSHARE_AYRSHARE_ACTIVE==='true';
        this.APIKEY = process.env.FAYRSHARE_AYRSHARE_API_KEY;
    }


    async preparePost(folder: Folder): Promise<Post | undefined> {
        return super.preparePost(folder);
    }

    async publishPost(post: Post, platformOptions: {}, dryrun:boolean = false): Promise<boolean> {
        const media = [
            ...post.files.image,
            ...post.files.video
        ].map(f=>post.folder.path+'/'+f);
        const uploads = media.length ? await this.uploadMedia(media) : []; 
        if (dryrun) {
            post.results.push({
                date: new Date(),
                dryrun: true,
                uploads: uploads,
                success: true,
                response: {}
            });
            post.save();
            return true;
        } 
        
        const result = await this.publishAyrshare(post,platformOptions, uploads);
        post.results.push(result);
        post.save();

        if (!result.success) {
            console.error(result.error);
        }
        return result.success ?? false;
    }

    async uploadMedia(media: string[]): Promise<string[]> {
        const urls= [] as string[];
        for (const file of media) {
            const buffer = fs.readFileSync(file); 
            const ext = path.extname(file);
            const basename = path.basename(file, ext);
            const uname = basename+'-'+randomUUID()+ext;
            console.log('fetching uploadid...',file);
            const res1 = await fetch("https://app.ayrshare.com/api/media/uploadUrl?fileName="+uname+"&contentType="+ext.substring(1), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${this.APIKEY}`
                }
            });

            if (!res1) {
                return [];
            }

            const data = await res1.json();
            //console.log(data);
            console.log('uploading..',uname);
            const uploadUrl = data.uploadUrl;
            const contentType = data.contentType;
            const accessUrl = data.accessUrl;
            
            const res2 = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                    "Content-Type": contentType,
                    "Authorization": `Bearer ${this.APIKEY}`
                },
                body: buffer,
            });

            if (!res2) {
                return [];
            }
            
            urls.push(accessUrl.replace(/ /g, '%20'));

        }
        return urls;
    }

    async publishAyrshare(post: Post, platformOptions: {}, uploads: string[]): Promise<AyrshareResult> {
        
        const result = {
            success: false,
            error: undefined,
            response: {}
        } as AyrshareResult;

        const postPlatform = this.platforms[this.slug];
        if (!postPlatform) {
            result.error = new Error('No ayrshare platform associated with platform '+this.slug);
            return result;
        }
        const body = JSON.stringify(uploads.length?{
            post: post.body, // required
            platforms: [postPlatform], // required
            mediaUrls: uploads, 
            scheduleDate: post.scheduled,
            requiresApproval: this.requiresApproval,
            ...platformOptions
            /*
            youTubeOptions: {
                title: post.title, // required max 100
                visibility: "public" // opt 'private'
            }, 
            instagramOptions: {
                // "autoResize": true -- only enterprise plans
                // isVideo: (this.data.type==='video'),
            },
            redditOptions: {
                title: this.data.title, // required 
                subreddit: REDDIT_SUBREDDIT,   // required (no "/r/" needed)
            }*/

        }:{
            post: post.body, // required
            platforms: [postPlatform], // required
            scheduleDate: post.scheduled,
            requiresApproval: this.requiresApproval
        });
        console.log('scheduling...',postPlatform);
        //console.log(body);
        const res = await fetch("https://app.ayrshare.com/api/post", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.APIKEY}`
            },
            body: body
        }).catch(e=> {
            result.error = e;
        });
        
        if (res && res.ok) {
            //console.log(res.json());
            result.response = await res.json()  as unknown as {
                status?: string
            };
            if (result.response['status']!=='success' && result.response['status']!=='scheduled') {
                result.success = false;
                result.error = new Error('bad result status: '+result.response['status']);
            } else {
                console.log(result);
            }
            return result;
        } 

        console.error(res);
        result.success = false;
        result.error = new Error('no result');
        return result;
    }
}