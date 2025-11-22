# Project Structure

This project contains both a React Native mobile app and a React.js web app.

## Directory Organization

```
AroundYouFYP-main/
├── app/                    # React Native Mobile App
│   ├── App.tsx            # Main React Native app component
│   ├── index.js           # React Native entry point
│   └── README.md          # Mobile app documentation
│
├── web/                    # React.js Web App
│   ├── index.html         # Web HTML entry point
│   ├── src/
│   │   ├── App.tsx        # Main web app component
│   │   ├── main.tsx       # Web entry point
│   │   ├── screens/       # Web-specific screens (React.js)
│   │   ├── components/    # Web-specific components
│   │   ├── navigation/    # React Router navigation
│   │   └── utils/         # Web polyfills and utilities
│   └── README.md          # Web app documentation
│
├── src/                    # Shared Code (used by both mobile and web)
│   ├── components/         # React Native components (shared)
│   ├── screens/            # React Native screens (shared)
│   ├── navigation/         # React Navigation (mobile only)
│   ├── context/            # React contexts (shared)
│   ├── hooks/              # Custom hooks (shared)
│   ├── services/           # API services (shared)
│   ├── stores/             # State management (shared)
│   ├── types/              # TypeScript types (shared)
│   ├── icons/              # SVG icons (shared)
│   └── utils/              # Utility functions (shared)
│
├── package.json            # Dependencies and scripts
├── babel.config.js         # Babel config (React Native)
├── metro.config.js         # Metro bundler config (React Native)
├── vite.config.ts          # Vite config (Web)
├── tailwind.config.js      # Tailwind config (React Native)
├── tailwind.config.web.js  # Tailwind config (Web)
└── tsconfig.json           # TypeScript config

```

## Platform-Specific Files

### React Native (Mobile App)
- **Location**: `app/` directory
- **Entry Point**: `app/index.js`
- **Main Component**: `app/App.tsx`
- **Screens**: `src/screens/` (React Native components)
- **Navigation**: `src/navigation/AppNavigator.tsx` (React Navigation)
- **Config**: `babel.config.js`, `metro.config.js`

### React.js (Web App)
- **Location**: `web/` directory
- **Entry Point**: `web/src/main.tsx`
- **Main Component**: `web/src/App.tsx`
- **Screens**: `web/src/screens/` (React.js components)
- **Navigation**: `web/src/navigation/WebNavigator.tsx` (React Router)
- **Config**: `vite.config.ts`, `tailwind.config.web.js`

## Shared Code

The `src/` directory contains code shared between both platforms:
- **Services**: API calls, Supabase client
- **Contexts**: Auth, Location
- **Hooks**: Custom React hooks
- **Types**: TypeScript type definitions
- **Icons**: SVG icon components
- **Utils**: Utility functions

## Running the Apps

### Mobile App (React Native)
```bash
npm start              # Start Metro bundler
npm run android        # Run on Android
npm run ios            # Run on iOS
```

### Web App (React.js)
```bash
npm run web:dev        # Start Vite dev server
npm run web:build      # Build for production
npm run web:preview    # Preview production build
```

## Key Differences

| Feature | React Native (Mobile) | React.js (Web) |
|---------|----------------------|----------------|
| Components | `View`, `Text`, `TouchableOpacity` | `div`, `span`, `button` |
| Navigation | React Navigation | React Router |
| Animations | React Native Animated | CSS transitions |
| Gradients | `react-native-linear-gradient` | CSS gradients |
| Entry Point | `app/index.js` | `web/src/main.tsx` |

## Notes

- The mobile app uses React Native components and React Navigation
- The web app uses standard HTML elements and React Router
- Both apps share the same business logic from `src/` directory
- Screens are platform-specific but follow the same UI/UX design

