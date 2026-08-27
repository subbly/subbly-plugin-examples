# Names, Uniqueness Scopes and Collisions

Most name clashes fail loudly. The linter or the release names the clash and stops. The cases below do not. They are silent, permanent, or fail where no error explains them.

## Runtime namespacing

Skills and agents run as `<plugin-slug>:<name>`. The builder adds the prefix. Never write it yourself.

Colons are not permitted in those names. Each runtime name holds exactly one colon. This stops a plugin from naming a skill `other-plugin:greet` to impersonate another plugin. Config vars use the same rule with `__`.

Names are case-sensitive: `my_skill`, `my-skill`, `Deploy` and `deploy` are four names. Keep them lowercase. A plugin cannot shadow a built-in, because plugin names always have the prefix.

## Traps

**1. Connector names get the plugin prefix.** The builder addresses each connector as `<plugin-slug>__<name>`, with slug hyphens turned into underscores. Plugin `alpha` with server `api` is `alpha__api`. Your slug is unique across all marketplaces, so the address is unique. Clashes with other plugins cannot occur. Never add the prefix yourself. The linter warns, because the builder would add it twice. Use the vendor name (`stripe`, `contentful`) and its official URL.

**2. A connector rename between versions destroys its credentials.** The builder removes the old connector and its stored OAuth credentials. Each user on that plugin must connect again.

**3. A plugin slug is claimed forever.** Archive does not release it. A slug of a removed plugin stays taken.

**4. A plugin rename destroys the installations.** The builder matches plugins by slug. It archives the old slug and inserts the new slug as a new plugin. The old installations stay, but they freeze on their last version and never update again. The UI marks them "No longer available". Config values use the name `PLUGIN_<SLUG>__<KEY>`, so they do not move to the new slug. Connector credentials and automation state belong to the old installation, so they do not move either. A plugin with `default: true` auto-installs the new slug beside the old one, and both sets of automations then run. Change `displayName` instead. It is safe.
