import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function FavoritesScreen() {
  const navigate = useNavigate();

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">Favorites</h1>
          <p className="text-gray-500 text-sm sm:text-base md:text-lg">Your favorite shops and items</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 md:p-10 lg:p-12"
        >
          <div className="text-center py-8 sm:py-10 md:py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-red-100 rounded-full mb-4 sm:mb-6">
              <span className="text-4xl sm:text-5xl">❤️</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No favorites yet</h2>
            <p className="text-gray-500 mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-base px-4">Start adding shops and items to your favorites to see them here</p>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/home')}
              className="px-6 sm:px-8 py-2.5 sm:py-3 md:py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold shadow-md hover:shadow-lg text-sm sm:text-base"
            >
              Explore Shops
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

