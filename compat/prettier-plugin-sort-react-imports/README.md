# prettier-plugin-sort-react-imports

> This package has moved to **[prettier-plugin-auto-sort-imports](https://www.npmjs.com/package/prettier-plugin-auto-sort-imports)**.

It now re-exports the new package, so your existing prettier config keeps working. To switch over:

```shell
npm uninstall prettier-plugin-sort-react-imports
npm install --save-dev prettier-plugin-auto-sort-imports
```

```diff
 {
-  "plugins": ["prettier-plugin-sort-react-imports"]
+  "plugins": ["prettier-plugin-auto-sort-imports"]
 }
```

The rename came with a rewrite that fixes several bugs, including one where a multiline `import React, { … } from 'react'` made prettier fail with a syntax error, and one where `// @sort-imports-ignore` had never worked in a published build. It also adds Prettier 3 support and works beyond React.

See the [changelog](https://github.com/crmapache/prettier-plugin-auto-sort-imports/blob/main/CHANGELOG.md) for the full list, including the behaviour changes.
