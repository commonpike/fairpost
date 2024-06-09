import { FileGroup } from "../models/Folder";
import Platform from "../models/Platform";
import { PlatformId } from "../platforms";
import Plugin from "../models/Plugin";
import Post from "../models/Post";

/**
 * Plugin LimitFiles.
 *
 * Remove files from Post based on Platform limits.
 *
 */

type LimitFilesSettings = {
  prefer?: FileGroup[];
  exclusive?: FileGroup[];
  total_max?: number;
  total_min?: number;
  image_min?: number;
  image_max?: number;
  video_min?: number;
  video_max?: number;
  text_min?: number;
  text_max?: number;
  other_min?: number;
  other_max?: number;
};

export default class LimitFiles extends Plugin {
  defaults: { [key in PlatformId]?: LimitFilesSettings } = {
    [PlatformId.UNKNOWN]: {
      prefer: [
        FileGroup.VIDEO,
        FileGroup.IMAGE,
        FileGroup.TEXT,
        FileGroup.OTHER,
      ],
      exclusive: [],
      total_max: 0,
      total_min: 0,
      image_min: 0,
      image_max: 0,
      video_min: 0,
      video_max: 0,
      text_min: 0,
      text_max: 0,
      other_min: 0,
      other_max: 0,
    },
    [PlatformId.FACEBOOK]: {
      exclusive: [FileGroup.VIDEO],
      video_max: 1,
    },
    [PlatformId.INSTAGRAM]: {
      total_max: 10,
    },
    [PlatformId.LINKEDIN]: {
      exclusive: [FileGroup.VIDEO],
      video_max: 1,
    },
    [PlatformId.REDDIT]: {
      total_max: 1,
    },
    [PlatformId.TWITTER]: {
      video_max: 0,
      image_max: 4,
    },
    [PlatformId.YOUTUBE]: {
      exclusive: [FileGroup.VIDEO],
      video_min: 1,
      video_max: 1,
    },
  };
  settings: LimitFilesSettings = {};
  constructor(platform: Platform) {
    super(platform);
    this.settings = {
      ...this.defaults[PlatformId.UNKNOWN],
      ...(this.defaults[platform.id] ?? {}),
    };
  }

  /**
   * Process the post
   */

  process(post: Post): void {
    post.platform.user.trace(this.id, post.id, "process");

    if (this.settings.total_min) {
      if (post.getFiles().length < this.settings.total_min) {
        post.platform.user.trace(
          this.id,
          post.id,
          "total_min",
          "Invalidate post",
        );
        post.valid = false;
        return;
      }
    }
    if (this.settings.image_min) {
      if (post.getFiles(FileGroup.IMAGE).length < this.settings.image_min) {
        post.platform.user.trace(
          this.id,
          post.id,
          "image_min",
          "Invalidate post",
        );
        post.valid = false;
        return;
      }
    }
    if (this.settings.video_min) {
      if (post.getFiles(FileGroup.VIDEO).length < this.settings.video_min) {
        post.platform.user.trace(
          this.id,
          post.id,
          "video_min",
          "Invalidate post",
        );
        post.valid = false;
        return;
      }
    }
    if (this.settings.text_min) {
      if (post.getFiles(FileGroup.TEXT).length < this.settings.text_min) {
        post.platform.user.trace(
          this.id,
          post.id,
          "text_min",
          "Invalidate post",
        );
        post.valid = false;
        return;
      }
    }
    if (this.settings.other_min) {
      if (post.getFiles(FileGroup.OTHER).length < this.settings.other_min) {
        post.platform.user.trace(
          this.id,
          post.id,
          "other_min",
          "Invalidate post",
        );
        post.valid = false;
        return;
      }
    }

    if (this.settings.exclusive?.length) {
      for (const exclusiveGroup of this.settings.exclusive) {
        if (post.hasFiles(exclusiveGroup)) {
          post.platform.user.trace(
            this.id,
            post.id,
            "exclusive",
            "Remove all files except " + exclusiveGroup,
          );
          for (const removeGroup of Object.values(FileGroup)) {
            if (removeGroup !== exclusiveGroup) {
              post.removeFiles(removeGroup);
            }
          }
          break;
        }
      }
    }

    if (this.settings.image_max) {
      const numfiles = post.getFiles(FileGroup.IMAGE).length;
      if (numfiles > this.settings.image_max) {
        post.platform.user.trace(
          this.id,
          post.id,
          "image_max",
          "Limit images to " + this.settings.image_max,
        );
        post.limitFiles(FileGroup.IMAGE, this.settings.image_max);
      }
    }
    if (this.settings.video_max) {
      const numfiles = post.getFiles(FileGroup.VIDEO).length;
      if (numfiles > this.settings.video_max) {
        post.platform.user.trace(
          this.id,
          post.id,
          "video_max",
          "Limit video to " + this.settings.video_max,
        );
        post.limitFiles(FileGroup.VIDEO, this.settings.video_max);
      }
    }
    if (this.settings.text_max) {
      const numfiles = post.getFiles(FileGroup.TEXT).length;
      if (numfiles > this.settings.text_max) {
        post.platform.user.trace(
          this.id,
          post.id,
          "text_max",
          "Limit text to " + this.settings.text_max,
        );
        post.limitFiles(FileGroup.TEXT, this.settings.text_max);
      }
    }
    if (this.settings.other_max) {
      const numfiles = post.getFiles(FileGroup.OTHER).length;
      if (numfiles > this.settings.other_max) {
        post.platform.user.trace(
          this.id,
          post.id,
          "other_max",
          "Limit other to " + this.settings.other_max,
        );
        post.limitFiles(FileGroup.OTHER, this.settings.other_max);
      }
    }
    if (this.settings.total_max) {
      let remaining = this.settings.total_max;
      for (const preferGroup of this.settings.prefer ??
        Object.values(FileGroup)) {
        if (remaining) {
          const numfiles = post.getFiles(preferGroup).length;
          if (numfiles > this.settings.total_max) {
            post.platform.user.trace(
              this.id,
              post.id,
              "total_max",
              "Limit " + preferGroup + " to " + remaining,
            );
            post.limitFiles(preferGroup, remaining);
          }
          remaining = Math.max(remaining - numfiles, 0);
        } else {
          post.removeFiles(preferGroup);
        }
      }
    }
  }
}
