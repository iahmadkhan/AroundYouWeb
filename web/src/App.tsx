import React from 'react';
import WebNavigator from './navigation/WebNavigator';

export default function App() {
  console.log('App component rendering...');
  try {
    return <WebNavigator />;
  } catch (error: any) {
    console.error('Error in App component:', error);
    return (
      <div className="p-5 bg-red-50 border-2 border-red-500 rounded-lg">
        <h1 className="text-xl font-bold text-red-700 mb-2">Error in App Component</h1>
        <pre className="text-sm text-red-600 whitespace-pre-wrap">{error?.message || String(error)}</pre>
        <pre className="text-xs text-red-500 mt-2 whitespace-pre-wrap">{error?.stack}</pre>
      </div>
    );
  }
}

