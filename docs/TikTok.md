
# Platform: Tiktok

Tiktok does not allow services to run for a single user.
This platform is not yet working.

# setup

- sign up for a developer account https://developers.tiktok.com/apps/
- create a personal app
  - Add the Login Kit and Content Posting API product to your app 
  - for the desktop redirect uri, use the details from your .env (http://localhost:8000/callback)
  - allow direct posting
  - for privacy policy, use https://github.com/commonpike/fairpost/blob/develop/public/privacy-policy.md
  - for terms of service, use https://github.com/commonpike/fairpost/blob/develop/public/terms-of-use.md
- wait 
- get rejected

# Limits


Video restrictions
Supported media formats

MP4 (recommended)
WebM
MOV
Supported codecs


H.264 (recommended)
H.265
VP8
VP9
Framerate restrictions

Minimum of 23 FPS
Maximum of 60 FPS
Picture size restrictions


Minimum of 360 pixels for both height and width
Maximum of 4096 pixels for both height and width
Duration restrictions


All TikTok creators can post 3-minute videos, while some have access to post 5-minute or 10-minute videos.
The longest video a developer can send via the initialize Upload Video endpoint is 10 minutes. TikTok users may trim developer-sent videos inside the TikTok app to fit their accounts' actual maximum publish durations.
Size restrictions

Maximum of 4GB
Image restrictions
Supported media formats

WebP
JPEG
Picture size restrictions

Maximum 1080p
Size restrictions

Maximum of 20MB for each image

# Random documentation

https://developers.tiktok.com/doc/content-posting-api-get-started/

"""
a. API Clients should display a preview of the to-be-posted content.
c. API Clients must only start sending content materials to TikTok after the user has expressly consent to the upload.
"""

video:
- get creator info (*)
  - show nickname
  - check max post and max_video_post_duration_sec
- do a video/init
  - check privacy_level_options from creator info
  - check  Interaction Ability from creator info
  - Users must manually turn on these interaction settings and none should be checked by default.
- post video to uploadurl

"API clients should poll the publish/status/fetch API or handle status update webhooks, so users can understand the status of their posts."

```
curl --location --request POST 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/' \
--header 'Authorization: Bearer act.example12345Example12345Example' \
--header 'Content-Type: application/json; charset=UTF-8'
```

```
curl --location 'https://open.tiktokapis.com/v2/post/publish/video/init/' \
--header 'Authorization: Bearer act.example12345Example12345Example' \
--header 'Content-Type: application/json; charset=UTF-8' \
--data-raw '{
  "post_info": {
    "title": "this will be a funny #cat video on your @tiktok #fyp",
    "privacy_level": "MUTUAL_FOLLOW_FRIENDS",
    "disable_duet": false,
    "disable_comment": true,
    "disable_stitch": false,
    "video_cover_timestamp_ms": 1000
  },
  "source_info": {
      "source": "FILE_UPLOAD",
      "video_size": 50000123,
      "chunk_size":  10000000,
      "total_chunk_count": 5
  }
}'

...

curl --location --request PUT 'https://open-upload.tiktokapis.com/video/?upload_id=67890&upload_token=Xza123' \
--header 'Content-Range: bytes 0-30567099/30567100' \
--header 'Content-Type: video/mp4' \
--data '@/path/to/file/example.mp4'

...

curl --location 'https://open.tiktokapis.com/v2/post/publish/status/fetch/' \
--header 'Authorization: Bearer act.example12345Example12345Example' \
--header 'Content-Type: application/json; charset=UTF-8' \
--data '{
    "publish_id": "v_pub_url~v2.123456789"
}'

```

for chunking:
https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide/

photo:
- just upload

```
curl --location 'https://open.tiktokapis.com/v2/post/publish/content/init/' \
--header 'Authorization: Bearer act.example12345Example12345Example' \
--header 'Content-Type: application/json' \
--data-raw '{
    "post_info": {
        "title": "funny cat",
        "description": "this will be a #funny photo on your @tiktok #fyp",
        "disable_comment": true,
        "privacy_level": "PUBLIC_TO_EVERYONE",
        "auto_add_music": true
    },
    "source_info": {
        "source": "PULL_FROM_URL",
        "photo_cover_index": 1,
        "photo_images": [
            "https://tiktokcdn.com/obj/example-image-01.webp",
            "https://tiktokcdn.com/obj/example-image-02.webp"
        ]
    },
    "post_mode": "DIRECT_POST",
    "media_type": "PHOTO"
}'

```

https://developers.tiktok.com/doc/content-sharing-guidelines

1) API Clients must retrieve the latest creator info when rendering the Post to TikTok page.

a. The upload page must display the creator's nickname, so users are aware of which TikTok account the content will be uploaded to.

b. When the creator_info API returns that the creator can not make more posts at this moment, API Clients must stop the current publishing attempt and prompt users to try again later.

c. When posting a video, API clients must check if the duration of the to-be-posted video follows the max_video_post_duration_sec returned in the creator_info API.


Content Disclosure Setting must be "Your Brand" or "Branded Content"

If a user wants to choose Branded Content, it is important to note that it can only be configured with visibility as public/friends.

When only "Your Brand" is checked, the declaration should be the same as mentioned above: "By posting, you agree to TikTok's Music Usage Confirmation."
When only "Branded Content" is checked, the declaration should be changed to: "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."
Additionally, when both options are selected, the declaration should be: "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."