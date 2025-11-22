# Web Application Setup

This document describes the web version of the AroundYou app, configured to match the mobile app's UI and flows exactly.

## 🎨 Color Scheme

The web app uses the exact same color scheme as the mobile app:
- **Primary Blue Gradient**: `#1e3a8a` → `#3b82f6` → `#60a5fa`
- **Active Tab Color**: `#2563eb` (primary-600)
- **Inactive Tab Color**: `#9ca3af` (gray-400)
- **Background**: `#f9fafb` (gray-50)
- **White**: `#ffffff`

## 🏗️ Architecture

### Web-Compatible Components
- **Location**: `web/src/components/web/`
  - `RNComponents.tsx` - Web wrappers for React Native components (View, Text, TouchableOpacity, etc.)
  - `LinearGradient.tsx` - Web-compatible gradient component
  - `react-native.ts` - Module export for `react-native` imports

### Polyfills
- **Location**: `web/src/utils/`
  - `webPolyfills.ts` - React Native API polyfills
  - `safeAreaContext.ts` - Safe area context for web
  - `haptics.ts` - Haptic feedback polyfill (no-op on web)

### Navigation
- **Location**: `web/src/navigation/WebNavigator.tsx`
  - Uses React Router instead of React Navigation
  - Maintains the same navigation structure and flows
  - Bottom tab bar matches React Navigation styling exactly

## 📦 Dependencies Added

### Runtime Dependencies
- `react-dom` - React for web
- `react-router-dom` - Web routing

### Dev Dependencies
- `vite` - Build tool
- `@vitejs/plugin-react` - React plugin for Vite
- `autoprefixer` - CSS autoprefixing
- `postcss` - CSS processing
- `@types/react-dom` - TypeScript types

## 🚀 Running the Web App

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run web:dev
   # or
   npm run web
   ```
   The app will open at `http://localhost:3000`

3. **Build for production:**
   ```bash
   npm run web:build
   ```

4. **Preview production build:**
   ```bash
   npm run web:preview
   ```

## 🔄 Navigation Flow

The web app maintains the same navigation flow as the mobile app:

1. **Splash Screen** → Checks location setup and user role
2. **Location Permission** → If location not set up
3. **First Launch Map** → Initial location selection
4. **Home/Search/Profile Tabs** → Main app screens
5. **Login/SignUp** → Authentication screens
6. **Merchant Screens** → Merchant-specific flows

## 🎯 Key Features

### Exact UI Matching
- ✅ Same color scheme and gradients
- ✅ Same component styling with Tailwind
- ✅ Same navigation structure
- ✅ Same bottom tab bar (72px height, matching colors)
- ✅ Same screen layouts and flows

### Web-Compatible APIs
- React Native components → Web HTML elements
- React Navigation → React Router
- LinearGradient → CSS gradients
- SafeAreaView → Standard divs
- Haptic Feedback → No-op (web doesn't support)

## 📝 Notes

1. **Icons**: Currently using emoji placeholders. Consider replacing with the same SVG icons from the mobile app for consistency.

2. **Maps**: React Native Maps won't work on web. Consider using Google Maps JavaScript API or similar for map functionality.

3. **Native Features**: Some React Native features (camera, native file picker, etc.) will need web alternatives.

4. **Environment Variables**: The web app uses the same `.env` file structure. Make sure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set.

## 🐛 Troubleshooting

### Module Resolution Issues
If you see import errors, make sure:
- Vite aliases are correctly configured in `vite.config.ts`
- All polyfills are imported before other code

### Styling Issues
- Ensure Tailwind is processing correctly (check `tailwind.config.web.js`)
- Verify `global.css` is imported in `main.tsx`
- Check that PostCSS is configured correctly

### Navigation Issues
- Verify React Router routes match the screen names
- Check that navigation props are being passed correctly via `withNavigation` HOC

## 🔧 Configuration Files

- `vite.config.ts` - Vite build configuration
- `tailwind.config.web.js` - Tailwind config for web
- `postcss.config.js` - PostCSS configuration
- `web/src/main.tsx` - Web entry point
- `web/src/App.tsx` - Web app component

