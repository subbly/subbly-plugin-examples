The Contentful plugin exposes Contentful's hosted MCP server tools (entries, content types, assets, locales, tags, AI actions).

- Start with `subbly.contentful.get_initial_context({})`. It takes no parameters. Call it once, not before every other tool call.
- Every tool returns XML.
- Search with `search_entries` or `semantic_search` instead of listing everything.
- Entries stay drafts until published; publish only when the user asks for the change to go live.
- If Contentful tools are missing, re-establish the Contentful connection from the plugin page.
