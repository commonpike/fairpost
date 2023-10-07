
import Logger from "../Logger";
import Platform from "../Platform";
import { PlatformSlug } from ".";
import Folder from "../Folder";
import Post from "../Post";
import * as fs from 'fs';
import * as sharp from 'sharp';

export default class Facebook extends Platform {
    slug: PlatformSlug = PlatformSlug.FACEBOOK;
    GRAPH_API_VERSION: string = 'v18.0';

    constructor() {
        super();
    }

    async preparePost(folder: Folder): Promise<Post | undefined> {
        const post = await super.preparePost(folder);
        if (post && post.files) {
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
        return super.publishPost(post,dryrun);
    }

    /*
    * Return a long lived page access token.
    * 
    * UserAccessToken: a shortlived user access token
    */ 
    async getPageToken(appUserId: string, userAccessToken :string): Promise<string> {

        // get a long lived UserAccessToken
        /*
        let url1 = `https://graph.facebook.com/${this.GRAPH_API_VERSION}`;
        url1 += '/oauth/access_token?';
        url1 += "grant_type=fb_exchange_token&";
        url1 += `client_id=${process.env.FAIRPOST_FACEBOOK_APP_ID}&`;
        url1 += `client_secret=${process.env.FAIRPOST_FACEBOOK_APP_SECRET}&`;
        url1 += `fb_exchange_token=${userAccessToken}`;
        */

        const url = new URL('https://graph.facebook.com');
        url.pathname = this.GRAPH_API_VERSION + "/oauth/access_token";
        const query = {
            grant_type : "fb_exchange_token",
            client_id : process.env.FAIRPOST_FACEBOOK_APP_ID,
            client_secret : process.env.FAIRPOST_FACEBOOK_APP_SECRET,
            fb_exchange_token : userAccessToken
        };
        url.search = new URLSearchParams(query).toString();

        Logger.trace('fetching',url.href);
        const res1 = await fetch(url,{
            method: 'GET',
            headers: { 'Accept': 'application/json'},
        });
        const data1 = await res1.json();
        const llUserAccessToken = data1['access_token'];

        if (!llUserAccessToken) {
            console.error(data1);
            throw new Error('No llUserAccessToken access_token in response.');
        }

        /*let url2 = `https://graph.facebook.com/${this.GRAPH_API_VERSION}`;
            url2 += `/${appUserId}/accounts?`;
            url2 += `access_token=${llUserAccessToken}`;

            Logger.trace('fetching',url2);
            const res2 = await fetch(url2,{
                method: 'GET',
                headers: { 'Accept': 'application/json'},
            });
            const data2 = await res2.json();
        */

        const url2 = new URL('https://graph.facebook.com');
        url2.pathname = appUserId + "/accounts";
        const query2 = {
            access_token : llUserAccessToken
        };
        url2.search = new URLSearchParams(query2).toString();
        Logger.trace('fetching',url.href);
        const res2 = await fetch(url2,{
            method: 'GET',
            headers: { 'Accept': 'application/json'},
        });
        const data2 = await res2.json();
        
        let llPageAccessToken = '';
        if (data2.data) {
            data2.data.forEach(page=> {
                if (page.id===process.env.FAIRPOST_FACEBOOK_PAGE_ID) {
                    llPageAccessToken = page.access_token;
                }
            })
        }
        if (!llPageAccessToken) {
            console.error(data2);
            throw new Error('No llPageAccessToken for page '+process.env.FAIRPOST_FACEBOOK_PAGE_ID+'  in response.');
        }

        return llPageAccessToken;
    }

    async test() {
        return this.get();
    }

    private async get(
        method: string = '', 
        query: { [key:string]: string } = {}
    ) {
        const url = new URL('https://graph.facebook.com');
        url.pathname = this.GRAPH_API_VERSION + "/" + process.env.FAIRPOST_FACEBOOK_PAGE_ID +"/" + method,
        url.search = new URLSearchParams(query).toString();
        Logger.trace('fetching',url.href);
        const res = await fetch(url,{
            method: 'GET',
            headers: process.env.FAIRPOST_FACEBOOK_PAGE_ACCESS_TOKEN ? { 
                'Accept': 'application/json',
                'Authorization': 'Bearer '+process.env.FAIRPOST_FACEBOOK_PAGE_ACCESS_TOKEN
            }: {
                'Accept': 'application/json'
            }
        });
        const result = await res.json();
        console.log(result);
        return result;
    }

}