
const fs = require('fs');
require('dotenv').config();

const APIKEY = process.env.AYRSHARE_API_KEY;
const defBody = "#Ayrshare feed";

const appTitle = 'Ayrshare feed';
const feedPath = './feed';
const postFile = 'post.json';

var prompt = require('prompt');
prompt.start();

class Post {

    static nextPostDate = new Date();
    static postDateInterval = 7; // days
    static platforms = {
        video: ["facebook", "instagram", "youtube"],
        image: ["twitter", "facebook", "instagram"],
        text: ["twitter", "facebook"]
    };
    id = "";
    path = "";
    body = "";
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
            this.body = fs.readFileSync(postDir+'/body.txt'); 
        } catch (e) {
            this.body = defBody;
        }
        this.images = files.filter(file=>["jpg","jpeg","png"].includes(file.split('.').pop()));
        this.videos = files.filter(file=>["mp4"].includes(file.split('.').pop()));
        

        this.write();
    }
    write() {
        fs.writeFileSync(this.path+'/'+postFile,this.getData());
    }
    getData() {
        return JSON.stringify({
            id : this.id,
            path : this.path,
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
        this.scheduled = Post.nextPostDate;
        if (this.images.length) {
            await this.scheduleImagePost();
        } else if (this.videos.length) {
            await this.scheduleVideoPost();
        } else {
            await this.scheduleTextPost();
        }
        this.write();
        Post.nextPostDate.setDate(Post.nextPostDate.getDate()+Post.postDateInterval);
    }
    
    async scheduleTextPost() {
        this.platforms = Post.platforms['text'];
        this.result = await this.scheduleAyrShare([]);
    }
    async scheduleImagePost() {
        this.platforms = Post.platforms['image'];
        const media = this.images; // ... 
        this.result = await this.scheduleAyrShare(media);
    }
    async scheduleVideoPost() {
        this.platforms = Post.platforms['video'];
        const media = this.video; // ... 
        this.result = await this.scheduleAyrShare(media);
    }

    async scheduleAyrShare(media) {
        return ['ok'];
        const res = await fetch("https://app.ayrshare.com/api/post", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${APIKEY}`
          },
          body: JSON.stringify(media.length?{
            post: this.body, // required
            platforms: this.platforms, // required
            mediaUrls: this.media, //optional
            scheduleDate: this.scheduled
          }:{
            post: this.body, // required
            platforms: this.platforms, // required
            scheduleDate: this.scheduled
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

    Post.nextPostDate = new Date('2023-01-01');
    const posts = [];
    getDirectories(feedPath).forEach(postDir=> {
        posts.push(new Post(feedPath+'/'+postDir));
    });
    for (const post of posts) {
        await post.handle();
    }

    console.log();
    console.log('All done.');
}

main();