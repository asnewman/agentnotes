---
id: 01HQXK5M8N2P3R4S5T6V7W8X9Y
title: Project Architecture
tags:
    - architecture
    - design
    - important
created: 2024-01-15T10:30:00Z
updated: 2026-02-02T07:23:52.931749Z
source: user
comments:
    - id: 01HQXK6A1B2C3D4E5F6G7H8J9K
      author: claude
      start_char: 0
      end_char: 24
      created: 2024-01-15T11:00:00Z
      content: Consider using a hexagonal architecture pattern for better testability.
    - id: 01HQXK7B2C3D4E5F6G7H8J9KL
      author: user
      start_char: 165
      end_char: 230
      created: 2024-01-16T09:15:00Z
      content: Need to revisit the database layer design.
    - id: 01KGEKS2Q3SPQT1FVGNBE579E5
      author: user
      start_char: 255
      end_char: 290
      created: 2026-02-02T07:23:52.931749Z
      content: hello
---
# Project Architecture

## Overview

This document outlines the high-level architecture for the AgentNotes application.

## Core Components

1. **CLI Layer** - Handles user input and command parsing
2. **Notes Package** - Core business logic for note management
3. **Storage Layer** - File-based persistence with YAML frontmatter

## Design Principles

- Keep it simple and local-first
- No external database dependencies
- Human-readable file format
- Easy to version control

## Future Considerations

- Add search indexing for large note collections
- Consider SQLite for metadata queries
- Plugin system for custom renderers
