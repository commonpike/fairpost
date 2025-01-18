# Plugins

Fairpost hosts a few plugins to prepare your Post
for your Platform. Such plugins can f.e. scale
images and/or remove certain files from a post
before it is scheduled and published.

All plugins have an `id` and `settings` and 
a static `defaults`. The format of the 
defaults/settings differs per plugin.

It's the platform that selects the plugins and its 
settings; some platform may allow you to add more 
plugins and/or change the settings.

## Calling a plugin

To have a plugin process a post, simply create the
plugin with optionally its settings, and call the 
`process` method. The example below will scale all
images in your post to have a maximum of 300px width,
maintaining the ratio, and limit it to 3 images:

```php
<?php

import LimitFiles from "../plugins/LimitFiles";
import ImageSize from "../plugins/ImageSize";

....
const limitfiles = new LimitFiles({image_max:3});
await limitfiles.process(post);
const imgsize = new ImageSize({max_width:300});
await imgsize.process(post);
post.save();
```

Inside a `Platform`, can load multiple plugins at once,
passing the settings for all of them keyed by their id.
The below code does the same as the above code:

```php
<?php

const plugins = this.loadPlugins({
    'limitfiles': { max_images: 3 },
    'imagesize': { max_width: 300 }
});
for (const plugin of plugins) {
    await plugin.process(post);
}
post.save();
```

## Writing a plugin

To write a plugin, extend the `Plugin` class
and implement the constructor and the `process` method.
By default, the Plugins `id` will be its classname
lowercased, but you can override this by writing 
a static method `id()`.
```php
<?php

export default class DoStuff extends Plugin {
  static defaults = { howmany: 10; }
  settings : { howmany?: number; };

  constructor(settings: { howmany?: number; }) {
    super();
    this.settings = {
      ...this.defaults,
      ...settings ?? {},
    };
  }

  async process(post: Post): Promise<void> {
    // do stuff how many times.
    // no need to save the post.
  }
  ```