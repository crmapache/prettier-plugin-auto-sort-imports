# Release checklist

## 1. Rename the GitHub repository

Rename `prettier-plugin-sort-imports` to `prettier-plugin-auto-sort-imports` in the repository settings. GitHub redirects the old URLs, so nothing breaks.

Then add repository topics: `prettier`, `prettier-plugin`, `imports`, `sort-imports`, `formatting`, `typescript`.

## 2. Publish the new package

```shell
npm publish
```

`prepublishOnly` cleans, typechecks, rebuilds and runs the tests first. Confirm the tarball afterwards:

```shell
npm pack --dry-run
```

It must contain only `dist/`, `package.json`, `README.md` and `LICENSE`.

## 3. Publish the compatibility shim and deprecate the old name

```shell
cd compat/prettier-plugin-sort-react-imports
npm publish

npm deprecate prettier-plugin-sort-react-imports \
  "Moved to prettier-plugin-auto-sort-imports. This version re-exports it; please switch over."
```

Deprecating rather than unpublishing means existing installs keep working and everyone sees the notice on their next install.

## 4. Get listed

- Open a PR against [prettier/prettier.io](https://github.com/prettier/prettier.io) adding the plugin to the community plugins page.
- Submit to the `awesome-prettier` style lists.
- Both should link to the README's comparison table, which is the clearest statement of what makes this plugin different.

## 5. Announce

Drafts are in [`docs/announcements.md`](./announcements.md).
