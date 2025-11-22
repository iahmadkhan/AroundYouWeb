# Web Application

This directory contains the web version of the AroundYou application.

## Setup

1. Install dependencies:
```bash
npm install
# or
yarn install
# or
bun install
```

## Development

Run the development server:
```bash
npm run web:dev
# or
npm run web
```

The app will be available at `http://localhost:3000`

## Build

Build for production:
```bash
npm run web:build
```

The built files will be in the `dist/` directory.

## Preview

Preview the production build:
```bash
npm run web:preview
```

## Web-Compatible Dependencies

The following dependencies from the main package.json are web-compatible:
- `react` & `react-dom` - React framework
- `@supabase/supabase-js` - Supabase client
- `react-query` - Data fetching
- `react-hook-form` - Form handling
- `@hookform/resolvers` - Form validation resolvers
- `zod` - Schema validation
- `zustand` - State management

## Notes

- The web app shares the same source code from `src/` directory
- Tailwind CSS is configured for web in `tailwind.config.web.js`
- Vite is used as the build tool for fast development and optimized production builds

