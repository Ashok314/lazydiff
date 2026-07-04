# TODO

## Post-release

- Smart file-navigation folder pruning.
  - Current release should prioritize stable diff filtering and accurate visible counts.
  - GitHub's file navigation is dynamic and can virtualize or rewrite folder rows when users expand/collapse directories.
  - Do not use broad selectors such as `[role='treeitem'][id]`, `[data-path]`, or `a[title]` to hide navigation rows.
  - Future fix should reconstruct folder paths from GitHub's tree model and hide a folder only when every descendant file is filtered.
- Independent filtered-count mode for GitHub's native file filter.
  - LazyDiff should be able to show visible additions/deletions for files currently shown by GitHub's own filter, even when the LazyDiff filter input is empty.
  - LazyDiff filters can then layer on top of GitHub's visible set.
