# AI Agent Instructions for English Jones App

## Project Overview
This is a Node.js/Express web application for teaching English vocabulary, integrating EJS templating, Socket.IO, MySQL, and i18n for localization. The app serves interactive activities for students and teachers, using a large vocabulary dataset and SVG-based visual assets.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express
- **Templating**: EJS
- **Database**: MySQL
- **Real-time**: Socket.IO
- **Localization**: i18n
- **Frontend**: Vanilla JavaScript, SVG

## Architecture & Key Components
- **Express server** (`ej.js`): Main entry point; sets up routes, view engine, static assets, localization, session management, Socket.IO, and error handling.
- **Routes** (`routes/`): Modular route handlers:
  - `routes/_MAIN.js`: Main app logic and activity handling.
  - `routes/teachers.js`: Teacher portal and management.
  - `routes/media.js`: Media asset delivery and management.
  - `routes/labs.js`: Experimental activities and labs.
  - `routes/letters.js`: Phonics and letter activities.
  - `routes/things.js`: Things/supplies activities.
  - `routes/lobby.js` & `lobby/`: Socket.IO multiplayer lobby and real-time room handling.
  - `routes/vocab.js`: Vocabulary endpoints.
  - `routes/auth.js`: Authentication (Google OAuth / Passport).
  - `routes/api.js` & `routes/tools.js`: API helpers and developer tools.
- **Views** (`views/`): EJS templates for activities, tools, students, teachers, and menus. Activities are grouped by type and audience.
- **Public assets** (`public/`): Images (SVG, PNG, etc.), audio, vocabulary data, and client-side JavaScript for activities.
- **Vocabulary** (`public/vocabulary.js`): Large array of word objects with metadata (`id`, `book`, `theme`, `meaning`, `image`, `audio`).
- **SVG Processing Scripts** (`build_object_ejs.js`, `build_supply_ejs.js`, `process_svgs.js`): Used to generate EJS templates and JS definitions from SVG files for activities and supplies.
- **Localization** (`locales/en.json`, `locales/ja.json`): i18n JSON translation files for English and Japanese.

## Developer Workflows
- **Run/Debug**: Start server with `node ej.js`. Port configured in `.env` (`PORT`).
- **Database**: MySQL credentials loaded from `.env`. Main pool initialized in `routes/_MAIN.js` / config. `links` table is used for activity decks.
- **Localization**: Add translations to `locales/en.json` and `locales/ja.json`. i18n auto-reloads.

## Project-Specific Patterns & Conventions
- **SVG Filenames**: Use underscores for spaces, parentheses for disambiguation (see `README.md` in `public/image/svg/`).
- **Activity Routing**: Activities are rendered via `/activities/:activity` and `/activities/:activity/:id` endpoints, with deck data from the database or `vocabulary.js`.
- **Decks**: Decks are arrays of word IDs or objects, passed via POST or stored in DB (`links` table).
- **EJS Wrappers**: SVGs are wrapped in `<div class="object" data-shape="...">` or `<div class="supply" data-shape="...">` for activities.
- **Error Handling**: 404 and general errors render EJS templates (`404.ejs`, `error.ejs`).
- **Localization Usage**: Use `req.__(...)` in routes/middleware and `<%= __('...') %>` in templates for translating themes and UI strings.

## Integration Points
- **Socket.IO**: Real-time multiplayer rooms via `lobby/lobby.js` and server initialization in `ej.js`.
- **MySQL**: Used for storing activity links, sessions (`express-mysql-session`), and retrieving decks.
- **Authentication**: Passport.js with Google OAuth 2.0 strategy.

## Examples
- To add a new activity, create an EJS template in `views/activities/`, add a route in `routes/_MAIN.js`, and update deck handling as needed.
- To add new vocabulary, update `public/vocabulary.js` and ensure images/audio are present in `public/image/` and `public/audio/`.
- To process new SVGs, run the relevant build script and commit the generated files.

## Agent Capabilities & Automated Workflows

AI agents working on this project should proactively assist with these capabilities:

### 1. Vocabulary Management
**When**: `public/vocabulary.js` is modified
**Actions**:
- Check that corresponding images exist in `public/image/` for each vocabulary entry
- Check that corresponding audio exists in `public/audio/` for each vocabulary entry
- Validate metadata completeness for all entries:
  - Required fields: `id`, `book`, `theme`, `meaning`, `image`, `audio`
- Flag missing or incomplete entries
- Prompt for asset uploads when missing

### 2. Activity & Template Guidance
**When**: New activities or templates are being created
**Actions**:
- Suggest correct template location in `views/activities/`
- Enforce proper wrapper conventions:
  - Objects: `<div class="object" data-shape="...">`
  - Supplies: `<div class="supply" data-shape="...">`
- Update routing in `routes/_MAIN.js`:
  - Ensure routes follow pattern: `/activities/:activity` and `/activities/:activity/:id`
  - Verify deck data source (DB `links` table or `vocabulary.js`)
- Guide deck structure (arrays of word IDs or objects)

### 3. Localization Support
**When**: Code, templates, or locale files are modified
**Actions**:
- Scan for untranslated keys in code and templates
- Prompt for updates to `locales/en.json` and `locales/ja.json`
- Verify proper i18n usage: `req.__(...)`
- Ensure translation completeness across both languages
- Check that new UI strings are added to both locale files

### 4. Deck & Routing Validation
**When**: Activity routes or deck handling is modified
**Actions**:
- Validate POST/GET flows for activities
- Check deck structure and data sources
- Ensure DB links in `links` table are correctly created and referenced
- Verify deck data is properly passed to templates

### 5. Framework Migration Assistance
**When**: Refactoring or modernization is needed
**Actions**:
- Flag non-standard patterns
- Suggest refactor targets
- Automate repetitive migration steps
- List files using legacy patterns and suggest modern replacements

## Automated Triggers Summary

| Trigger | Condition | Automated Response |
|---------|-----------|-------------------|
| SVG Added | New file in `public/image/svg/` | Run appropriate build script, validate output |
| Vocabulary Updated | Changes to `public/vocabulary.js` | Check for missing images/audio, validate metadata |
| Activity Created | New template in `views/activities/` | Guide location, enforce wrappers, update routing |
| Localization Changed | Modifications to locale files or i18n calls | Scan for missing translations, verify completeness |
| Route Modified | Changes to routing files | Validate deck handling and data flow |

## References
- **Main server**: `ej.js`
- **Routing**: `routes/_MAIN.js`, `routes/teachers.js`, `routes/media.js`, `routes/labs.js`, `routes/letters.js`, `routes/things.js`, `routes/lobby.js`, `routes/vocab.js`, `routes/auth.js`, `routes/api.js`, `routes/tools.js`
- **Views**: `views/activities/`, `views/tools/`, `views/students/`, `views/teachers/`
- **Assets**: `public/image/`, `public/audio/`, `public/vocabulary.js`
- **SVG conventions**: `public/image/svg/README.md`
- **Localization**: `locales/en.json`, `locales/ja.json`

## Setup for AI Agents

When working on this project, AI agents should:

1. **Detect project structure** by reading this configuration file
2. **Apply automated workflows** based on file changes and triggers
3. **Validate changes** against project conventions before committing
4. **Suggest improvements** when non-standard patterns are detected
5. **Provide context-aware assistance** using the architecture and conventions outlined above

## Development Commands

```bash
# Start development server
nodemon ej.js
node ej.js

# Testing
npm test

# Database connection
# MySQL pool configured in routes/_MAIN.js
# Credentials from .env: PORT, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
```

---
_This file is maintained as `AGENTS.md` and serves as the primary reference for AI coding agents._
