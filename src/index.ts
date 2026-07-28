import { options } from './options'
import { parsers } from './parsers'

export { options, parsers }
export { sortImports } from './preprocess'

// Prettier 2 reads the named exports off `require()`; prettier 3 imports the
// module and falls back to `default`. Providing both keeps one build working
// on either version.
export default { options, parsers }
