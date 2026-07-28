# Announcement drafts

Written to be published by the maintainer. Nothing here is auto-posted.

---

## dev.to post

**Title:** Three ways to sort imports with Prettier, and what each one costs you

**Tags:** javascript, typescript, prettier, webdev

---

Every JavaScript project eventually argues about import order. Prettier deliberately does not sort imports, so the job falls to a plugin. There are three popular ones, and they solve the problem in genuinely different ways. It is worth knowing which trade-off you are signing up for.

### 1. Describe the order with regular expressions

`@trivago/prettier-plugin-sort-imports` and its actively maintained fork `@ianvs/prettier-plugin-sort-imports` both work the same way: you write the order out as a list of regexes.

```json
"importOrder": ["^@core/(.*)$", "^@server/(.*)$", "^@ui/(.*)$", "^[./]"]
```

This gives you total control. It also means that the moment someone adds an `@features` alias to `tsconfig.json`, the config here silently stops covering it, and those imports quietly land in whatever bucket happens to catch them. The information already exists in your tsconfig. You are just copying it by hand into a second place and keeping the two in sync forever.

### 2. Let TypeScript do it

`prettier-plugin-organize-imports` calls the TypeScript language service's "Organize Imports" - the same thing your editor runs. It is zero-config and it removes unused imports for free, which is a genuinely great feature.

The cost is control. It sorts everything into one alphabetical block. You cannot ask for your own aliases in a separate group, and you cannot get blank lines between groups. You also need TypeScript installed, and spinning up a language service is not free.

### 3. Read the config that already exists

This is the gap I wanted to fill, so I rewrote my own plugin around it: `prettier-plugin-auto-sort-imports`.

It parses your file, then reads `tsconfig.json` or `jsconfig.json` to find out which prefixes are yours. Node builtins, npm packages, your aliases and relative imports each get their own group, separated by blank lines. No regexes, no configuration.

```javascript
import { useMemo, useState } from 'react'
import Image from 'next/image'
import debounce from 'lodash/debounce'

import { Box, Tabs, Typography } from '@core'

import { Backdrop } from '../FrontBackdrop'
import { TAB_OPTIONS } from './Faq.constants'

import './styles.scss'
```

### Monorepos get the same treatment

The same idea extends one step further. In a monorepo, your own packages are dependencies, so every sorter puts `@acme/ui` next to `react` and `lodash`. But it is your code, and the information saying so is already there - a `workspace:` range, a `workspaces` field, a `pnpm-workspace.yaml`. So it gets its own group:

```javascript
import { useState } from 'react'
import * as Yup from 'yup'

import { Button } from '@acme/ui'
import { api } from '@acme/api-client'

import { TextField } from '@/components/TextField'
```

Aliases are resolved from the tsconfig nearest to the file, so each package in the repo gets its own set. Again, nothing to configure.

### What the rewrite taught me

The old version of my plugin found imports with regular expressions applied line by line. That approach fails in ways that are hard to anticipate:

- A multiline `import React, {\n useState,\n} from 'react'` as the last import produced invalid code. Prettier then refused to format the file at all. That is the single most common import in React.
- A line starting with `import` inside a template literal got a blank line injected into it - silently changing a runtime string value, with no error anywhere.
- `// eslint-disable-next-line` above an import stayed put while the import moved, so it ended up suppressing a rule on someone else's import.
- With prettier's default `semi: true`, half the imports were not sorted at all, because the pattern expected lines to end with a quote.

None of these are subtle bugs in the logic. They are all the same bug: a regex does not know where a syntax construct begins and ends. Parsing the file made every one of them disappear at once.

The other thing I would do differently from the start: the build output was committed to git. A feature I added months earlier had never actually reached anyone, because the published build predated it. `dist` is gitignored now and `prepublishOnly` rebuilds and tests, so that particular failure cannot happen twice.

### If you want to try it

```shell
npm install --save-dev prettier-plugin-auto-sort-imports
```

```json
{ "plugins": ["prettier-plugin-auto-sort-imports"] }
```

Coming from trivago or ianvs, deleting your `importOrder` block is usually the whole migration.

Source and comparison table: https://github.com/crmapache/prettier-plugin-auto-sort-imports

---

## Reddit

Candidate communities: r/javascript, r/reactjs, r/typescript, r/webdev, r/node. Read the posting notes further down before submitting anything.

**Title:** I rewrote my Prettier import-sorting plugin to read tsconfig aliases instead of making you write regexes

The existing plugins either make you describe your import order with regular expressions (trivago, ianvs) or hand the job to TypeScript and give up grouping entirely (organize-imports). I wanted the middle: grouped imports with blank lines, and no configuration, because the aliases are already sitting in `tsconfig.json`.

The same idea covers monorepos, which none of the three handle. Your own packages are dependencies, so they sort next to `react` and `lodash` even though they are your code. This one reads the workspace protocol, the `workspaces` field or `pnpm-workspace.yaml` and gives them their own group:

```javascript
import { useState } from 'react'
import * as Yup from 'yup'

import { Button } from '@acme/ui'
import { api } from '@acme/api-client'

import { TextField } from '@/components/TextField'
```

Rewriting it on a real parser also killed a set of bugs I could not have fixed otherwise. The worst one: a multiline `import React, { useState } from 'react'` as the last import in the block produced invalid code and made prettier fail outright.

Zero config, works on JS and TS, frontend and backend, Prettier 2 and 3.

https://github.com/crmapache/prettier-plugin-auto-sort-imports

Happy to hear where it falls over.

---

## X / Twitter

Rewrote my Prettier import sorter.

Other plugins make you write regexes to describe your import order. Your aliases are already in tsconfig.json - so this one just reads them.

Same for monorepos: your own packages get their own group instead of sorting next to react and lodash. Read from the workspace protocol, nothing to configure.

Grouped imports, blank lines between groups, zero config. JS and TS, front and back, Prettier 2 and 3.

github.com/crmapache/prettier-plugin-auto-sort-imports

---

## Posting notes for Reddit

**Pick a community, not your profile.** The submit form defaults to `u/yourname`, which posts to your own profile page - it never reaches anyone's feed. Use the selector at the top of the form and choose the subreddit.

**Read each subreddit's rules first, in that subreddit.** Self-promotion is restricted in most large technical communities, and the shape of the restriction differs: a dedicated day, a weekly thread, a ratio between your own posts and your other participation. A post that breaks the rule is removed by a bot, usually without a notification, so it looks published to you and is invisible to everyone else. These rules change, so check them at the time of posting rather than trusting any summary.

**Account age and karma matter.** Large subreddits filter posts from new or low-karma accounts automatically, before a human sees them. If the account is fresh, spend a couple of weeks commenting where you actually have something to say, then post.

**Post the write-up, not the link.** Text first, link at the end, and a real question to close. A link-only submission reads as an ad; a post someone can learn from even without installing anything does not.

**One community at a time.** Posting the same text to several subreddits within a few minutes is what spam filters look for. Space them out and adjust the angle to each audience.

---

## Notes on tone

Keep the comparisons factual. trivago, ianvs and organize-imports are all good, well-maintained projects with millions of users, and the regex approach is a legitimate design choice rather than a mistake. The honest pitch is "different trade-off", not "better plugin" - readers can smell the difference, and the credibility is worth more than the claim.

**Re-check the competitive claims on the day you post.** These drafts say the other three do not read tsconfig aliases and do not group monorepo packages. That was verified from their published READMEs, but they ship releases, and being publicly wrong about a rival's features costs more than the sentence is worth. If a claim no longer holds, drop it - the rest of the pitch stands on its own.

**Do not oversell the bug list.** The rewrite fixed real defects, including one that made prettier fail outright, and that story is worth telling because other people hit the same class of problem. But it was a bug in my own plugin, and framing it as a general industry insight rather than as something I shipped and then fixed would read as spin.
