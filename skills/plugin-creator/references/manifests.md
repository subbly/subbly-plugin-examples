# Manifest Options

Each key the builder accepts in `marketplace.json` and `plugin.json`, as JSON Schema. `additionalProperties: false` means an unknown key fails the release. `true` means the builder strips it silently. A typo reports nothing.

## marketplace.json

```json
{
  "type": "object",
  "required": ["slug", "version", "plugins"],
  "additionalProperties": true,
  "properties": {
    "$schema": { "type": "string", "description": "Optional, ignored." },
    "slug": {
      "type": "string",
      "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      "maxLength": 64,
      "description": "The marketplace's own slug."
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+(-[a-z0-9]+(\\.[a-z0-9]+)*)?$",
      "maxLength": 50,
      "description": "The only release trigger. A bump on main is the only way content ships. An optional lowercase pre-release suffix like -beta.1 is permitted."
    },
    "plugins": {
      "type": "array",
      "description": "Each directory under plugins/ must be listed. An unlisted one never ships. An empty array archives all plugins at release.",
      "items": {
        "type": "object",
        "required": ["slug", "source"],
        "additionalProperties": true,
        "properties": {
          "slug": {
            "type": "string",
            "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            "maxLength": 64,
            "description": "Unique in the file. Claimed once for the whole platform. Must equal the plugin.json name."
          },
          "published": { "type": "boolean" },
          "source": {
            "type": "object",
            "required": ["type", "path"],
            "additionalProperties": true,
            "properties": {
              "type": { "const": "local" },
              "path": {
                "type": "string",
                "maxLength": 200,
                "description": "Safe segments only: no leading /, no .., no segment that starts with a dot. Must exist on disk. The basename must equal the slug (convention: plugins/<slug>)."
              }
            }
          }
        }
      }
    }
  }
}
```

## plugin.json

```json
{
  "type": "object",
  "required": ["$schema", "name", "description", "extensions"],
  "additionalProperties": false,
  "properties": {
    "$schema": { "const": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json" },
    "name": {
      "type": "string",
      "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      "maxLength": 64,
      "description": "Must equal the marketplace entry slug. The UI shows displayName, not this."
    },
    "description": { "type": "string", "minLength": 1, "maxLength": 500 },
    "version": {
      "type": "string",
      "description": "Accepted, then discarded with a warning. Remove it. The marketplace.json version is the only release trigger."
    },
    "author": {
      "type": "object",
      "required": ["name"],
      "additionalProperties": false,
      "properties": {
        "name": { "type": "string", "minLength": 1, "maxLength": 100 },
        "email": { "type": "string", "maxLength": 200 },
        "url": { "type": "string", "maxLength": 500 }
      }
    },
    "homepage": { "type": "string", "maxLength": 500 },
    "repository": { "type": "string", "maxLength": 500 },
    "license": { "type": "string", "maxLength": 100 },
    "keywords": {
      "type": "array",
      "maxItems": 20,
      "items": { "type": "string", "minLength": 1, "maxLength": 50 }
    },
    "extensions": {
      "type": "object",
      "required": ["co.subbly.builder"],
      "properties": {
        "co.subbly.builder": {
          "type": "object",
          "required": ["displayName"],
          "additionalProperties": false,
          "properties": {
            "displayName": {
              "type": "string",
              "minLength": 1,
              "maxLength": 100,
              "description": "The name the UI shows."
            },
            "image": { "type": "string", "minLength": 1, "maxLength": 500 },
            "default": {
              "type": "boolean",
              "description": "true auto-installs the plugin. A required field is then an error, because no user is present to fill it."
            },
            "setup": {
              "type": "boolean",
              "description": "true adds a Finish setup button. It loads skills/install/SKILL.md. Without that exact skill the button leads nowhere, and lint rejects the pair."
            },
            "fields": {
              "type": "array",
              "description": "Each field becomes env var PLUGIN_<SLUG>__<KEY>. Field objects are loose. The builder strips an unknown or misspelled key silently.",
              "items": {
                "type": "object",
                "required": ["key", "label", "type"],
                "additionalProperties": true,
                "properties": {
                  "key": {
                    "type": "string",
                    "pattern": "^[A-Z][A-Z0-9_]*$",
                    "maxLength": 50,
                    "description": "Copied unchanged into the env var name. It lands in the project's git-committed example.env. Never start with PLUGIN_. The builder adds that prefix."
                  },
                  "label": { "type": "string", "minLength": 1, "maxLength": 100 },
                  "type": { "enum": ["text", "select"] },
                  "required": {
                    "type": "boolean",
                    "description": "Blocks the install dialog. Holds the installation on its current version until filled."
                  },
                  "secret": {
                    "type": "boolean",
                    "description": "Masks the input. Mutually exclusive with public."
                  },
                  "public": {
                    "type": "boolean",
                    "description": "Exposes the value to the browser as NEXT_PUBLIC_PLUGIN_<SLUG>__<KEY>. Never mark a credential public."
                  },
                  "pattern": {
                    "type": "string",
                    "maxLength": 200,
                    "description": "Compiled as ^(?:<pattern>)$ with no flags. Write case-insensitivity as [Aa]. Applies to select values too."
                  },
                  "options": {
                    "type": "array",
                    "minItems": 1,
                    "items": { "type": "string", "minLength": 1, "maxLength": 100 },
                    "description": "select only, and required there. The strings are the labels the user sees."
                  }
                }
              }
            },
            "automations": {
              "type": "object",
              "description": "Keyed by automation slug. Each slug also needs co.subbly.builder/automations/<slug>.md (see automations.md).",
              "patternProperties": {
                "^[a-z0-9]+(?:-[a-z0-9]+)*$": {
                  "type": "object",
                  "required": ["name", "schedule", "model"],
                  "additionalProperties": false,
                  "properties": {
                    "name": { "type": "string", "minLength": 1, "maxLength": 100 },
                    "schedule": {
                      "type": "string",
                      "maxLength": 100,
                      "description": "Cron expression with a 15-minute floor. Checked by sample firings."
                    },
                    "model": { "enum": ["normal", "intelligent-high"] }
                  }
                }
              }
            },
            "connectors": {
              "type": "object",
              "description": "Only for servers in mcp.json that need OAuth. Keyed by connector name, 1-100 chars. The builder prefixes it with the plugin slug (see names-and-collisions.md).",
              "patternProperties": {
                "^.{1,100}$": {
                  "type": "object",
                  "required": ["auth"],
                  "additionalProperties": false,
                  "properties": { "auth": { "const": "oauth" } }
                }
              }
            }
          }
        }
      }
    }
  }
}
```
