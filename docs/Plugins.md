# Plugins

Fairpost hosts a few plugins to prepare your Post
for your Platform. Such plugins can f.e. scale
images and/or remove certain files from a post
before it is scheduled and published.

All plugins have an `id` and `settings` and 
a static `defaults`. The format of the 
defaults/settings differs per plugin.

It's the platform source that defines the required
plugins and its default settings; some platform may 
allow a user to add more plugins and/or override the 
settings.

## Calling a plugin

Inside a `Platform`, `pluginSettings` is an object
with plugin ids as keys and default settings as values.
One optional key, 'name', is reserved for the name of these
settings in User.settings, that can override these
defaults.

```php
<?php

export default class MyPlatform extends Platform {
  pluginSettings = {
    name: 'MYPLATFORM_PLUGIN_SETTINGS',
    textsize: {
      max_length: 300,
    },
  }
```

Using this, on preparePost, the textSite plugin
will be applied automatically with the settings given,
and these settings can be overriden with MYPLATFORM_PLUGIN_SETTINGS
in the user settings.

To call a plugin manually instead, instantiate the
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

  Once you created the plugin, you can use it in all
  platforms that allow you to manage plugins, and/or 
  in a new platform you're implementing.