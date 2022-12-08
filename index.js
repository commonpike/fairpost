
const fs = require('fs');
require('dotenv').config();
const APIKEY = process.env.AYRSHARE_API_KEY;

const feedPath = './feed';
const defDescription = process.env.DEF_DESCRIPTION;

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

async function handlePostDir(postDir) {
    console.log('handling '+postDir+' ..');
    const files = getFiles(postDir);
    if (files.includes('.scheduled')) {
        const date = fs.readFileSync(postDir+'/.scheduled');
        console.log('Already scheduled on '+date);  
        console.log();  
        return;
    }
    const body = fs.readFileSync(postDir+'/description.txt');
    // catch error
    const imageFiles = files.filter(file=>["jpg","jpeg","png"].includes(file.split('.').pop()));
    const videoFiles = files.filter(file=>["mp4"].includes(file.split('.').pop()));
    let success =false, posted=false;
    if (imageFiles.length) {
        const res = await createImagePost(postDir,body,imageFiles.map(file=>postDir+'/'+file));
        success = true; // check
        posted = true; // write stamp
    }
    if (videoFiles.length) {
        const res = await createVideoPost(postDir,body,videoFiles.map(file=>postDir+'/'+file));
        success = true; // check
        posted = true; // write stamp
    }
    if (!posted) {
        const res = await createTextPost(postDir,body);
        success = true; // check
        posted = true; // write stamp
    }
    console.log();
}


async function createTextPost(body) {
    return await createPost(body,[],["twitter", "facebook"])

}

async function createImagePost(body,files) {
    return await createPost(body,[],["twitter", "facebook", "instagram"])

}

async function createVideoPost(body,files) {
    return await createPost(body,[],["facebook", "instagram", "youtube"])
}

async function createPost(body,media,platforms) {
    const res = await fetch("https://app.ayrshare.com/api/post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${APIKEY}`
      },
      body: JSON.stringify(media.length?{
        post: body, // required
        platforms: platforms, // required
        mediaUrls: media, //optional
        scheduleDate: date
      }:{
        post: body, // required
        platforms: platforms, // required
        scheduleDate: date
      }),
    }).catch(console.error);
    return res.json();
}

/* main */

console.log('Ayrshare-feed starting .. ');
console.log();

if (!fs.existsSync(feedPath)) {
    fs.mkdirSync(feedPath);
}

getDirectories(feedPath).forEach(postDir=> {
    handlePostDir(feedPath+'/'+postDir);
});
