import { FileGroup, FileInfo } from "../models/Folder";

import Platform from "../models/Platform";
import { PlatformId } from "../platforms";
import Plugin from "../models/Plugin";
import Post from "../models/Post";
import sharp from "sharp";
import untypedDefaults from "./ImageSize.defaults.json";

/**
 * Plugin ImageSize.
 *
 * Resize images from Post based on Platform limits.
 *
 */

type ImageSizeSettings = {
  fit?: string; // 'cover' | 'contain';
  bgcolor?: string;
  min_size?: number;
  max_size?: number;
  min_ratio?: number;
  max_ratio?: number;
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
};

export default class ImageSize extends Plugin {
  settings: ImageSizeSettings;

  constructor(platform: Platform) {
    super(platform);
    const defaults: { [key in PlatformId | "default"]?: ImageSizeSettings } =
      untypedDefaults;
    this.settings = {
      ...defaults["default"],
      ...(defaults[platform.id] ?? {}),
    };
  }

  /**
   * Process the post
   */

  async process(post: Post): Promise<void> {
    post.platform.user.trace(this.id, post.id, "process");
    for (const file of post.getFiles(FileGroup.IMAGE)) {
      await this.fixDimensions(post, file);
    }
    for (const file of post.getFiles(FileGroup.IMAGE)) {
      await this.fixFileSize(post, file);
    }
  }

  private async fixDimensions(post: Post, file: FileInfo) {
    if (file.width && file.height) {
      const { imgw, imgh, canw, canh } = this.getDimensions(
        file.width,
        file.height,
        this.settings.min_width,
        this.settings.max_width,
        this.settings.min_height,
        this.settings.max_height,
        this.settings.min_ratio,
        this.settings.max_ratio,
        this.settings.fit as "cover" | "contain",
      );
      if (
        file.width !== imgw ||
        file.height !== imgh ||
        canw !== imgw ||
        canh !== imgh
      ) {
        post.platform.user.trace(
          "ImageSize.fixDimensions",
          file.name +
            ":" +
            file.width +
            "x" +
            file.height +
            "=>" +
            imgw +
            "x" +
            imgh +
            "[" +
            canw +
            "x" +
            canh +
            "]",
        );
        const newFileName =
          post.platform.id +
          "-" +
          file.basename +
          "-" +
          imgw +
          "x" +
          imgh +
          "." +
          file.extension;
        const src = file.name;
        const dst = post.platform.assetsFolder + "/" + newFileName;
        const padh = Math.floor((canh - imgh) / 2);
        const padw = Math.floor((canw - imgw) / 2);
        await sharp(post.getFilePath(file.name))
          .resize({
            width: imgw,
            height: imgh,
          })
          .extend({
            top: padh,
            bottom: padh,
            left: padw,
            right: padw,
            background: this.settings.bgcolor,
          })
          .toFile(post.getFilePath(dst));
        await post.replaceFile(src, dst);
      }
    }
  }

  private async fixFileSize(post: Post, file: FileInfo) {
    if (this.settings.min_size && file.size <= this.settings.min_size) {
      throw post.platform.user.error(
        "ImageSize.fixFileSize",
        "Image is too small",
        post.id + ":" + file.name + ":" + file.size,
      );
    }
    if (this.settings.max_size) {
      await this.reduceFileSize(post, file, this.settings.max_size);
    }
  }

  private async reduceFileSize(
    post: Post,
    file: FileInfo,
    maxkb: number,
  ): Promise<void> {
    if (file.width && file.size / 1024 >= maxkb) {
      if (file.mimetype !== "image/jpeg") {
        console.log(file.mimetype);
        const dst =
          post.platform.assetsFolder +
          "/" +
          file.basename +
          "-" +
          file.extension +
          ".jpg";
        post.platform.user.trace(
          "ImageSize.reduceFileSize",
          post.id + ":" + file.name + ": to jpg",
        );
        await sharp(post.getFilePath(file.name))
          .keepExif()
          .toFormat("jpg") // default q = 80
          .toFile(post.getFilePath(dst));
        await post.replaceFile(file.name, dst);
        file = await post.folder.getFileInfo(dst, file.order);
      }
    }
    if (file.width && file.size / 1024 >= maxkb) {
      const newFileName = file.basename + "-small." + file.extension;
      const dst = post.platform.assetsFolder + "/" + newFileName;
      let newfile = await post.folder.getFileInfo(file.name, file.order);
      let factor = 1;
      let count = 1;
      while (newfile.size / 1024 >= maxkb) {
        factor = factor * Math.sqrt((0.9 * maxkb) / (newfile.size / 1024));
        post.platform.user.trace(
          "ImageSize.reduceFileSize",
          post.id + ":" + file.name + ": scale " + factor,
        );
        await sharp(post.getFilePath(file.name))
          .keepExif()
          .resize({
            width: Math.round(file.width * factor),
          })
          .toFile(post.getFilePath(dst));
        newfile = await post.folder.getFileInfo(dst, file.order);
        if (count++ > 5) {
          throw post.platform.user.error(
            "ImageSize.reduceFileSize",
            "Failed to scale down",
            post.id + ":" + file.name + ":" + factor,
          );
        }
      }
      await post.replaceFile(file.name, dst);
    }
  }

  private getDimensions(
    imgw: number,
    imgh: number,
    minw = 0,
    maxw = 0,
    minh = 0,
    maxh = 0,
    minr = 0,
    maxr = 0,
    fit: "cover" | "contain" = "contain",
  ): { imgw: number; imgh: number; canw: number; canh: number } {
    if (minw && imgw < minw) {
      imgh = (imgh * minw) / imgw;
      imgw = minw;
      // we scaled up to a minimum; if the height is now
      // too big, we should crop height or pad width
      // either way result is minw x maxh
      if (maxh && imgh > maxh) {
        if (fit === "cover") {
          return this.croph(imgw, imgh, minw, maxh);
        }
        if (fit === "contain") {
          return this.padw(imgw, imgh, minw, maxh);
        }
      }
    }
    if (minh && imgh < minh) {
      imgw = (imgw * minh) / imgh;
      imgh = minh;
      // we scaled up to a minimum; if the width is now
      // too big, we should crop width or pad height
      // either way result is maxw x minh
      if (maxw && imgw > maxw) {
        if (fit === "cover") {
          return this.cropw(imgw, imgh, maxw, minh);
        }
        if (fit === "contain") {
          return this.padh(imgw, imgh, maxw, minh);
        }
      }
    }
    if (maxw && imgw > maxw) {
      imgh = (imgh * maxw) / imgw;
      imgw = maxw;
      // we scaled down to a maximum; if the height is now
      // too small, we should crop the width or pad the height
      // either way result is maxw x minh
      if (minh && imgh < minh) {
        if (fit === "cover") {
          return this.cropw(imgw, imgh, maxw, minh);
        }
        if (fit === "contain") {
          return this.padh(imgw, imgh, maxw, minh);
        }
      }
    }
    if (maxh && imgh > maxh) {
      imgw = (imgw * maxh) / imgh;
      imgh = maxh;
      // we scaled down to a maximum; if the width is now
      // too small, we should crop the height or pad the width
      // either way result is minw x maxh
      if (minw && imgw < minw) {
        if (fit === "cover") {
          return this.croph(imgw, imgh, minw, maxh);
        }
        if (fit === "contain") {
          return this.padw(imgw, imgh, minw, maxh);
        }
      }
    }
    const imgr = imgw / imgh;
    if (maxr && imgr > maxr) {
      // the image is too wide. either crop the width
      // or pad the height till it fits
      if (fit === "cover") {
        const width = imgh * minr;
        const height = imgh;
        return this.cropw(imgw, imgh, width, height);
      }
      if (fit === "contain") {
        const width = imgw;
        const height = imgw / minr;
        return this.padw(imgw, imgh, width, height);
      }
    }
    if (minr && imgr < minr) {
      // the image is too high. either crop the height
      // or pad the width till it fits
      if (fit === "cover") {
        const width = imgw;
        const height = imgw / minr;
        return this.cropw(imgw, imgh, width, height);
      }
      if (fit === "contain") {
        const width = imgh * minr;
        const height = imgh;
        return this.padw(imgw, imgh, width, height);
      }
    }
    imgw = Math.round(imgw);
    imgh = Math.round(imgh);
    const canw = imgw;
    const canh = imgh;
    return { imgw, imgh, canw, canh };
  }

  /*
    cropw: crop width; 
    scale the image so imgh = height, retain ratio
    crop the image so canw = width
  */
  private cropw(
    imgw: number,
    imgh: number,
    width: number,
    height: number,
  ): { imgw: number; imgh: number; canw: number; canh: number } {
    imgw = Math.round((imgw * height) / imgh); // scale up
    imgh = Math.round(height);
    const canw = Math.round(width); // crop
    const canh = Math.round(height);
    return { imgw, imgh, canw, canh };
  }
  /*
    croph: crop height; 
    scale the image so imgw = width, retain ratio
    crop the image so canh = height
  */
  private croph(
    imgw: number,
    imgh: number,
    width: number,
    height: number,
  ): { imgw: number; imgh: number; canw: number; canh: number } {
    imgh = Math.round((imgh * width) / imgw);
    imgw = Math.round(width);
    const canh = Math.round(height); // crop
    const canw = Math.round(width);
    return { imgw, imgh, canw, canh };
  }

  /*
    padw: pad width; 
    scale the image so imgh = height, retain ratio
    pads the image so canw = width
  */
  private padw(
    imgw: number,
    imgh: number,
    width: number,
    height: number,
  ): { imgw: number; imgh: number; canw: number; canh: number } {
    imgw = Math.round((imgw * imgh) / height);
    imgh = Math.round(height);
    const canw = Math.round(width); // pad
    const canh = imgh;
    return { imgw, imgh, canw, canh };
  }
  /*
    padh: pad height; 
    scale the image so imgw = height, retain ratio
    pads the image so canh = width
  */
  private padh(
    imgw: number,
    imgh: number,
    width: number,
    height: number,
  ): { imgw: number; imgh: number; canw: number; canh: number } {
    imgh = Math.round((imgh * imgw) / width);
    imgw = Math.round(width);
    const canh = Math.round(height); // pad
    const canw = imgw;
    return { imgw, imgh, canw, canh };
  }
}
