export default interface PlatformDto {
  model: string;
  id: string;
  user_id: string;
  active?: boolean;
  connected?: boolean;
  settings?: {
    [key: string]: {
      label: string;
      value: string; // straight from store.settings
    };
  };
  plugins?: {
    name?: string;
    [pluginid: string]: object | string | undefined; // stringified object
  };
  // remove
  // more fields added by platform
  //[key: string]: string | string[] | number | boolean | undefined;
}
