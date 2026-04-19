# Project structure of ramean extensions

ramean structure repo:

- docs/
  - guidelines/
  - project_structure.md -> this current file
  - installation_guide.md -> instructions on how to install and set up the ramean extensions
- extensions/
  - subagents/ -> all logic and code related to subagents, including their creation, management, execution, and everything.
  - tools/ -> custom made tools.
  - UI/ -> everything related to the user interface, including components, styles, and assets.
  - core/ -> core logic and utilities that are shared across the extensions, such as common functions, classes, and configurations.
  - commands/ -> custom commands that can be used within the extensions, including their implementation and documentation.
  - others/ -> miscellaneous code or extensions that doesn't fit into the other categories but is still essential for the functioning.
  - types/ -> type definitions and interfaces that are used across the extensions to ensure type safety and consistency.
  - tests/ -> all test cases and testing utilities for the extensions, ensuring that the code is reliable and functions as expected.
  - index.ts -> the main entry point for the extensions, where everything is exported and made available for use in the main project.
  - config.yaml -> configuration file for the extensions, where users can customize settings and options for the extensions to fit their needs.
- AGENTS.md
