---
id: 01HQXR5EFGH1234567890124
title: API Endpoints
tags:
  - backend
  - api
  - documentation
created: 2024-02-01T14:30:00Z
updated: 2024-02-01T14:30:00Z
source: development
priority: 4
comments: []
---

# API Endpoints

## Authentication

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Token refresh

## Users

- `GET /users` - List all users
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

## Notes

- `GET /notes` - List all notes
- `POST /notes` - Create note
- `GET /notes/:id` - Get note
- `PUT /notes/:id` - Update note
- `DELETE /notes/:id` - Delete note
