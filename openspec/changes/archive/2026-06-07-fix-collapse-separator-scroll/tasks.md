## 1. Main JS Logic Changes

- [x] 1.1 Implement horizontal scroll coordinate translation for 3-way view inside handleScroll of src/main.tsx
- [x] 1.2 Dynamically set the --scroll-x CSS variable on scrolling panes in handleScroll of src/main.tsx
- [x] 1.3 Initialize and update --scroll-x variable in syncPaneX useEffect callback of src/main.tsx
- [x] 1.4 Enrich displayChunks with positioning metrics (leftY, rightY, etc.) when collapseEnabled is false

## 2. CSS Style Improvements

- [x] 2.1 Update .collapsed-separator style rules in src/styles.css to use left positioning with var(--scroll-x) offset
- [x] 2.2 Update first-child and last-child .collapsed-separator background-position rules in src/styles.css
- [x] 2.3 Update first-child and last-child .collapsed-separator.hovered background-position rules in src/styles.css
