import * as fs from 'fs';
import Logger from './Logger';

export default class Folder {

  id: string;
  path: string;
  files?: {
    text: string[],
    image: string[],
    video: string[],
    other: string[]
  };

  constructor(path: string) {
    this.id = path;
    this.path = path;
  }

  getFiles() {
    Logger.trace('Folder','getFiles');
    if (this.files!=undefined) {
      return {
        text: [ ...this.files.text ],
        image: [ ...this.files.image ],
        video: [ ...this.files.video ],
        other: [ ...this.files.other ]
      };
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
    return {
      text: [ ...this.files.text ],
      image: [ ...this.files.image ],
      video: [ ...this.files.video ],
      other: [ ...this.files.other ]
    };
  }

}