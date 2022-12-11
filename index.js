
const fs = require('fs');
require('dotenv').config();
const fetch = require('node-fetch');

const APIKEY = process.env.AYRSHARE_API_KEY;

const appTitle = 'Ayrshare feed';
const feedPath = './feed';



var prompt = require('prompt');
prompt.start();

// TBD move to class
const defBody = "#Ayrshare feed";
const postFile = 'post.json';

class Post {

    static nextPostDate = new Date();
    static postDateInterval = 7; // days
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
        if (files.includes(postFile)) {
            const data = JSON.parse(fs.readFileSync(this.path+'/'+postFile));
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
            this.body = defBody;
        }
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
        fs.writeFileSync(this.path+'/'+postFile,this.getData());
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
        this.result = await this.scheduleAyrShare([]);
        this.id = this.result.id;
    }
    async scheduleImagePost() {
        this.platforms = Post.platforms['image'];
        const media = await this.uploadMedia(this.images); 
        this.result = await this.scheduleAyrShare(media);
        this.id = this.result.id;
    }
    async scheduleVideoPost() {
        this.platforms = Post.platforms['video'];
        const media = await this.uploadMedia(this.videos); 
        this.result = await this.scheduleAyrShare(media);
        this.id = this.result.id;
    }

    async uploadMedia(media) {
        const urls= [];
        for (const file of media) {
            const buffer = fs.readFileSync(this.path+'/'+file); 
            const ext = file.split('.').pop();
            const res1 = await fetch("https://app.ayrshare.com/api/media/uploadUrl?fileName="+file+"&contentType="+ext, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${APIKEY}`
                }
            })
            .catch(console.error);
            const data = await res1.json();
            console.log(data);
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
            console.log(res2);
            urls.push(accessUrl);

        }
        return urls;
    }

    async scheduleAyrShare(media) {
        if (Post.testing) {
            return ['testing'];
        }

        const title = this.body.split('\n', 1)[0];
        const res = await fetch("https://app.ayrshare.com/api/post", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${APIKEY}`
          },
          body: JSON.stringify(media.length?{
            post: this.body, // required
            platforms: this.platforms, // required
            mediaUrls: media, 
            scheduleDate: this.scheduled,
            requiresApproval: Post.requiresApproval,
            isVideo: (this.type==='video'),
            youTubeOptions: {
                title: title, // required max 100
                visibility: "public" // optional def private
            }
          }:{
            post: this.body, // required
            platforms: this.platforms, // required
            scheduleDate: this.scheduled,
            requiresApproval: Post.requiresApproval
          }),
        }).catch(console.error);
        return res.json();
    }

}




function getDirectories(path) {
    return fs.readdirSync(path).filter(function (file) {
        return fs.statSync(path+'/'+file).isDirectory();
    });
}
function getFiles(path) {
    return fs.readdirSync(path).filter(function (file) {
        return fs.statSync(path+'/'+file).isFile();
    });
}



/* main */
async function main() {
    console.log(appTitle+' starting .. ');
    console.log();

    if (!fs.existsSync(feedPath)) {
        fs.mkdirSync(feedPath);
    }

    
    let lastPostDate = new Date('2022-12-04');
    const posts = [];
    getDirectories(feedPath).forEach(postDir=> {
        const post = new Post(feedPath+'/'+postDir);
        posts.push(post);
        if (post.scheduled && post.scheduled>lastPostDate) {
            //console.log(post.scheduled,lastPostDate);
            lastPostDate = new Date(post.scheduled);
        }
    });
    Post.nextPostDate = new Date(lastPostDate);
    Post.nextPostDate.setDate(Post.nextPostDate.getDate()+Post.postDateInterval);
    //console.log(Post.nextPostDate,lastPostDate);
    for (const post of posts) {
        await post.handle();
    }

    console.log();
    console.log('All done.');
}

main();