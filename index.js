
/*
    Usage
    node index.js --feed=path-to-dir --date=2023-03-18

    reads folders in dir `path-to-dir`
    creates Post object foreach folder
    determines post.type (text,images,video)
    if not scheduled yet, schedules it
    writes result in post.json in that dir

*/

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const { randomUUID } = require('crypto');

require('dotenv').config();
const fetch = require('node-fetch');

const APIKEY = process.env.AYRSHARE_API_KEY;



const feedPath = argv('feed') ?? process.env.AYRSHARE_FEEDPATH;
const nextPostDate = argv('date')?new Date(argv('date')):null;
const dryRun = argv('dry-run') ?? false;
const appTitle = 'Ayrshare feed';


class Post {

    static defBody = "#Ayrshare feed";
    static postFile = 'post.json';

    static nextPostDate = new Date();
    static postDateInterval = Number(process.env.AYRSHARE_INTERVAL); 
    static testing = false;
    static requiresApproval = false;
    static platforms = {
        video: ["facebook", "youtube","instagram"],
        image: ["twitter", "facebook", "instagram"],
        text: ["twitter", "facebook"]
    };
    id = "";
    path = "";
    body = "";
    type= "";
    images = [];
    videos = [];
    platforms = [];
    scheduled = null;
    posted= null;
    result = {};

    constructor(postPath) {
        this.path=postPath;
        const files = getFiles(this.path);
        if (files.includes(Post.postFile)) {
            const data = JSON.parse(fs.readFileSync(this.path+'/'+Post.postFile));
            if (data) {
                this.id = data?.id;
                this.scheduled= data?.scheduled?new Date(data.scheduled):null;
                this.posted = data?.posted?new Date(data.posted):null;
                this.result = data?.result;
            }
        }
        try {
            this.body = fs.readFileSync(this.path+'/body.txt','utf8'); 
        } catch (e) {
            this.body = Post.defBody;
        }
        // TBD this.title
        this.images = files.filter(file=>["jpg","jpeg","png"].includes(file.split('.').pop()));
        this.videos = files.filter(file=>["mp4"].includes(file.split('.').pop()));
        // TBD throw errors for mixed types
        if (this.images.length) {
            this.type="image";
        } else if (this.videos.length) {
            this.type="video";
        } else {
            this.type="text";
        }

        this.write();
    }
    write() {
        if (!Post.testing) {
            fs.writeFileSync(this.path+'/'+Post.postFile,this.getData());
        } else if (!this.posted) {
            //console.log('result:',this.getData());
        }
    }
    getData() {
        return JSON.stringify({
            id : this.id,
            path : this.path,
            type: this.type,
            body : this.body,
            images : this.images,
            videos : this.videos,
            platforms : this.platforms,
            scheduled : this.scheduled,
            posted : this.posted,
            result : this.result
        },null, "\t");
    }

    async handle() {
        if (!this.scheduled) {
            await this.schedule();
            console.log('* scheduling post '+this.path+' at '+this.scheduled);
        } else {
            console.log('- post '+this.path+' scheduled at '+this.scheduled);
        }
    }

    async  schedule() {
        this.scheduled = new Date(Post.nextPostDate);
        switch (this.type) {
            case "image":
                await this.scheduleImagePost();
                break;
            case "video":
                await this.scheduleVideoPost();
                break;
            default:
                await this.scheduleTextPost();
        }
        if (this.result.status!=='error') {
            Post.nextPostDate.setDate(Post.nextPostDate.getDate()+Post.postDateInterval);
        } else {
            this.scheduled=null;
        }
        this.write();
    }
    
    async scheduleTextPost() {
        this.platforms = Post.platforms['text'];
        this.result = await this.scheduleAyrShare([],this.platforms);
        this.id = this.result.id;
    }
    async scheduleImagePost() {
        this.platforms = Post.platforms['image'];
        this.result = [];
        let platforms = this.platforms;
        if (this.platforms.includes('instagram')) {
            const originalImages = this.images;
            const resizedImages = [];
            let haveResized=false;
            for (const image of originalImages) {
                const metadata = await sharp(this.path+'/'+image).metadata();
                if (metadata.width > 1440) {
                    console.log('Resizing '+image+' for instagram ..');
                    await sharp(this.path+'/'+image).resize({ width: 1440 }).toFile(this.path+'/_instagram-'+image);
                    resizedImages.push('_instagram-'+image);
                    haveResized=true;
                } else {
                    resizedImages.push(image);
                }
            }
            if (haveResized) {
                const media = await this.uploadMedia(resizedImages); 
                this.result.push(await this.scheduleAyrShare(media,'instagram'));
                platforms = platforms.filter(p=>p!=='instagram');
            }
        }
        const media = await this.uploadMedia(this.images); 
        if (media.length>4 && this.platforms.includes('twitter')) {
            this.result.push(await this.scheduleAyrShare(media.slice(0, 4),'twitter'));
            platforms = platforms.filter(p=>p!=='twitter');
        } 
        this.result.push(await this.scheduleAyrShare(media,platforms));
        this.id = this.result[0].id;
    }
    async scheduleVideoPost() {
        this.platforms = Post.platforms['video'];
        const media = await this.uploadMedia(this.videos); 
        this.result = await this.scheduleAyrShare(media,this.platforms);
        this.id = this.result.id;
    }

    async uploadMedia(media) {
        const urls= [];
        for (const file of media) {
            const buffer = fs.readFileSync(this.path+'/'+file); 
            const ext = path.extname(file);
            const basename = path.basename(file, ext);
            const uname = basename+'-'+randomUUID()+ext;
            const res1 = await fetch("https://app.ayrshare.com/api/media/uploadUrl?fileName="+uname+"&contentType="+ext.substring(1), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${APIKEY}`
                }
            })
            .catch(console.error);
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
                    "Authorization": `Bearer ${APIKEY}`
                },
                body: buffer,
            })
            .catch(console.error);
            //console.log(res2);
            urls.push(accessUrl.replace(/ /g, '%20'));

        }
        return urls;
    }

    async scheduleAyrShare(media,platforms=[]) {
        if (Post.testing) {
            return ['testing'];
        }
        if (!platforms.length) {
            return ['no platforms'];
        }

        // todo in constructor
        const title = this.body.split('\n', 1)[0];
        const res = await fetch("https://app.ayrshare.com/api/post", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${APIKEY}`
          },
          body: JSON.stringify(media.length?{
            post: this.body, // required
            platforms: platforms, // required
            mediaUrls: media, 
            scheduleDate: this.scheduled,
            requiresApproval: Post.requiresApproval,
            isVideo: (this.type==='video'),
            youTubeOptions: {
                title: title, // required max 100
                visibility: "public" // optional def private
            }, 
            instagramOptions: {
                // "autoResize": true -- only enterprise plans
            }
          }:{
            post: this.body, // required
            platforms: this.platforms, // required
            scheduleDate: this.scheduled,
            requiresApproval: Post.requiresApproval
          }),
        }).catch(console.error);
        const result = res.json();
        if (result['status']==='error') {
            console.error(result);
        } else {
            this.posted = new Date();
        }
        return result;
    }

}


function argv(key) {
    if ( process.argv.includes( `--${ key }` ) ) return true;
    const value = process.argv.find( element => element.startsWith( `--${ key }=` ) );
    if ( !value ) return null;
    return value.replace( `--${ key }=` , '' );
}

function getDirectories(path) {
    return fs.readdirSync(path).filter(function (file) {
        return !file.startsWith('_') && fs.statSync(path+'/'+file).isDirectory();
    });
}
function getFiles(path) {
    return fs.readdirSync(path).filter(function (file) {
        return !file.startsWith('_') && fs.statSync(path+'/'+file).isFile();
    });
}



/* main */
async function main() {

    Post.testing = Post.testing || dryRun;
    console.log(appTitle+' starting .. ',Post.testing?'dry-run':'');
    console.log();

    if (!fs.existsSync(feedPath)) {
        fs.mkdirSync(feedPath);
    }

    let lastPostDate = new Date();
    const posts = [];
    getDirectories(feedPath).forEach(postDir=> {
        const post = new Post(feedPath+'/'+postDir);
        posts.push(post);
        if (post.scheduled && post.scheduled>lastPostDate) {
            //console.log(post.scheduled,lastPostDate);
            lastPostDate = new Date(post.scheduled);
        }
    });

    const today = new Date();
    if (nextPostDate) {
        Post.nextPostDate = nextPostDate;
    } else if (lastPostDate<today) {
        Post.nextPostDate = today;
    } else {
        Post.nextPostDate = new Date(lastPostDate);
        Post.nextPostDate.setDate(Post.nextPostDate.getDate()+Post.postDateInterval);
    }
    //console.log(Post.nextPostDate,lastPostDate);
    for (const post of posts) {
        await post.handle();
    }

    console.log();
    console.log('All done',Post.testing?' (dry-run).':'.');
}

main();