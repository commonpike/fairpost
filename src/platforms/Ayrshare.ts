
import Logger from '../Logger';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PlatformSlug } from ".";
import Platform from "../Platform";
import Folder from "../Folder";
import Post from "../Post";
import { PostStatus } from "../Post";

interface AyrshareResult {
    success: boolean;
    error?: Error;
    response: {}
}

export default abstract class Ayrshare extends Platform {


    requiresApproval: boolean = false;

    // map fairpost platforms to ayrshare platforms
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
        if (result.success) {
            post.status = PostStatus.PUBLISHED;
        }
        post.save();

        if (!result.success) {
            console.error(result.error);
        }
        return result.success ?? false;
    }

    async uploadMedia(media: string[]): Promise<string[]> {
        const APIKEY = process.env.FAIRPOST_AYRSHARE_API_KEY;
        const urls= [] as string[];
        for (const file of media) {
            const buffer = fs.readFileSync(file); 
            const ext = path.extname(file);
            const basename = path.basename(file, ext);
            const uname = basename+'-'+randomUUID()+ext;
            Logger.trace('fetching uploadid...',file);
            const res1 = await fetch("https://app.ayrshare.com/api/media/uploadUrl?fileName="+uname+"&contentType="+ext.substring(1), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${APIKEY}`
                }
            });

            if (!res1) {
                return [];
            }

            const data = await res1.json();
            //console.log(data);
            Logger.trace('uploading..',uname);
            const uploadUrl = data.uploadUrl;
            const contentType = data.contentType;
            const accessUrl = data.accessUrl;
            
            const res2 = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                    "Content-Type": contentType,
                    "Authorization": `Bearer ${APIKEY}`
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
        
        const APIKEY = process.env.FAIRPOST_AYRSHARE_API_KEY;
        const scheduleDate = post.scheduled;
        //scheduleDate.setDate(scheduleDate.getDate()+100);
        
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
            scheduleDate: scheduleDate,
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
            scheduleDate: scheduleDate,
            requiresApproval: this.requiresApproval
        });
        Logger.trace('scheduling...',postPlatform);
        //console.log(body);
        const res = await fetch("https://app.ayrshare.com/api/post", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${APIKEY}`
            },
            body: body
        }).catch(e=> {
            result.error = e;
        });
        
        if (res) {
            if (res.ok) {
                //console.log(res.json());
                result.response = await res.json()  as unknown as {
                    status?: string
                };
                if (result.response['status']!=='success' && result.response['status']!=='scheduled') {
                    console.error('* Failed.');
                    result.error = new Error('Bad result status: '+result.response['status']);
                } else {
                    console.error(' .. Published.');
                    result.success = true;
                }
                return result;
            } 
            const response = await res.json();
            console.error('* Failed.');
            result.error = new Error(JSON.stringify(response));
            return result;
        }
        console.error('* Failed.');
        result.error = new Error('no result');
        return result;
    }
}