import * as fs from 'fs';
import * as path from 'path';

export default class Folder {

  path: string;
  files?: {
    text: string[],
    image: string[],
    video: string[],
    other: string[]
  };

  constructor(path: string) {
    this.path = path;
  }

  getFiles() {
    if (this.files!=undefined) {
      return { ...this.files };
    }
    const files = fs.readdirSync(this.path).filter(file => {
      return fs.statSync(this.path+'/'+file).isFile() && 
      !file.startsWith('_') && 
      !file.startsWith('.');
    });
    this.files = {
      text: [],
      image: [],
      video: [],
      other: []
    };
    this.files.text = files.filter(file=>["txt"].includes(file.split('.')?.pop()??''));
    this.files.image = files.filter(file=>["jpg","jpeg","png"].includes(file.split('.')?.pop()??''));
    this.files.video = files.filter(file=>["mp4"].includes(file.split('.')?.pop()??''));
    this.files.other = files.filter(file=>
      !this.files.text?.includes(file)
      && !this.files.image?.includes(file)
      && !this.files.video?.includes(file)
    );
    return { ...this.files };
  }

}