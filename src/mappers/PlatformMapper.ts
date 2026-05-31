import AbstractMapper from "./AbstractMapper.ts";
import { PlatformDto, FieldMapping } from "../types/index.ts";
import Operator from "../models/Operator.ts";
import Platform from "../models/Platform.ts";

export default class PlatformMapper extends AbstractMapper<PlatformDto> {
  private platform: Platform;
  private static platformMapping: FieldMapping = {
    model: {
      type: "string",
      label: "Model",
      get: ["any"],
      set: ["none"],
    },
    id: {
      type: "string",
      label: "ID",
      get: ["managePlatforms"],
      set: ["none"],
    },
    user_id: {
      type: "string",
      label: "User ID",
      get: ["managePlatforms"],
      set: ["none"],
    },
    active: {
      type: "boolean",
      label: "Active",
      get: ["managePlatforms"],
      set: ["managePlatforms"],
    },
    connected: {
      type: "boolean",
      label: "Connected",
      get: ["managePlatforms"],
      set: ["managePlatforms"],
    },
    settings: {
      type: "json",
      label: "Settings",
      get: ["managePlatforms"],
      set: ["managePlatforms"],
    },
    plugins: {
      type: "json",
      label: "Settings",
      get: ["managePlatforms"],
      set: ["managePlatforms"],
    },
  };

  mapping = structuredClone(PlatformMapper.platformMapping);

  constructor(platform: Platform) {
    super(platform.user);
    this.platform = platform;
  }

  /**
   * Return a dto based on the operator and operation
   * @param operator
   * @returns key/value pairs for the dto
   */
  async getDto(operator: Operator): Promise<PlatformDto> {
    const fields = this.getDtoFields(operator, "get");
    const pluginSettingsName = this.platform.pluginSettings.name;
    const permissions = operator.getPermissions(this.platform.user);
    const dto: PlatformDto = {
      user_id: this.user.id,
      model: "platform",
      id: this.platform.id,
    };
    for (const field of fields) {
      switch (field) {
        case "active":
          dto[field] = !!this.platform.active;
          break;
        case "connected":
          dto[field] = !!this.platform.connected;
          break;
        case "settings":
          const settings = {} as {
            [key: string]: { label: string; value: string };
          };
          for (const key in this.platform.settings) {
            if (key !== pluginSettingsName) {
              const needPermissions = this.platform.settings[key].get;
              const canGet =
                needPermissions.includes("any") ||
                needPermissions.some(
                  (permission) =>
                    permissions[permission as keyof typeof permissions],
                );
              if (canGet) {
                settings[key] = {
                  label: this.platform.settings[key].label,
                  value: this.platform.user.data.get("settings", key, ""),
                };
              }
            }
          }
          for (const key in this.platform.settings) {
            if (this.platform.settings[key].required) {
              if (!settings[key]) {
                this.platform.user.log.error(
                  "Missing required field in settings:" + key,
                );
                // now what ? proceed
              }
            }
          }
          dto[field] = settings;
          break;
        case "plugins":
          if (pluginSettingsName) {
            const userPluginSettings = this.platform.user.data.get(
              "settings",
              pluginSettingsName,
              "{}",
            );
            dto[field] = {
              ...this.platform.pluginSettings,
              ...(JSON.parse(userPluginSettings) || {}),
            };
            delete dto[field]?.name;
          } else {
            dto[field] = {};
          }
          break;
      }
    }
    return dto;
  }

  /**
   * Insert a given dto based on the operator
   * @param operator
   * @param dto
   * @returns boolean success
   */
  async putDto(operator: Operator, dto: PlatformDto): Promise<boolean> {
    const permissions = operator.getPermissions(this.platform.user);
    const fields = this.getDtoFields(operator, "set");
    for (const field in dto) {
      if (fields.includes(field)) {
        switch (field) {
          case "active":
            this.platform.active = !!dto[field];
            break;
          case "connected":
            this.platform.connected = !!dto[field];
            break;
          case "settings": {
            for (const key in this.platform.settings) {
              if (this.platform.settings[key].required) {
                if (!dto[field]?.[key]) {
                  throw this.platform.user.log.error(
                    "Missing required field in settings: " + key,
                  );
                }
              }
            }
            for (const key in dto[field]) {
              const needPermissions = this.platform.settings[key].set;
              const canSet =
                needPermissions.includes("any") ||
                needPermissions.some(
                  (permission) =>
                    permissions[permission as keyof typeof permissions],
                );
              if (canSet) {
                const value = dto[field][key].value;
                // todo: check this.platform.settings[key].type
                this.user.data.set("settings", key, String(value));
              }
            }
            break;
          }
          case "plugins": {
            const pluginSettingsName = this.platform.pluginSettings.name;
            if (pluginSettingsName) {
              // todo: remove defaults from platform.pluginSettings
              this.user.data.set(
                "settings",
                pluginSettingsName,
                JSON.stringify(dto[field]),
              );
            }
          }
        }
      } else {
        this.user.log.trace("Ignoring field: " + field);
      }
    }
    await this.platform.save();
    await this.user.data.save();
    return true;
  }
}
