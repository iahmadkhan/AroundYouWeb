import React from 'react';
import { motion } from 'framer-motion';
import ShopRating from './ShopRating';
import type { Shop } from '../../../src/services/supabase';

interface ShopCardProps {
  shop: Shop;
  onPress?: () => void;
  highlighted?: boolean;
}

export default function ShopCard({ shop, onPress, highlighted = false }: ShopCardProps) {
  const isClosed = !shop.is_open;
  const shopTypeLabel = shop.shop_type ? String(shop.shop_type).charAt(0).toUpperCase() + String(shop.shop_type).slice(1) : null;
  
  return (
    <motion.div
      onClick={onPress}
      whileHover={{ y: highlighted ? -4 : -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`rounded-2xl overflow-hidden cursor-pointer h-full flex flex-col transition-shadow duration-200 ${
        highlighted
          ? 'bg-gradient-to-br from-blue-600 to-blue-900 text-white shadow-xl hover:shadow-2xl'
          : isClosed
          ? 'bg-gray-100 shadow-sm hover:shadow-md'
          : 'bg-white shadow-sm hover:shadow-lg'
      }`}
    >
      {/* Shop Image */}
      {shop.image_url ? (
        <div className="w-full h-40 sm:h-44 md:h-48 lg:h-52 relative overflow-hidden">
          <motion.img
            src={shop.image_url}
            alt={shop.name}
            className="w-full h-full object-cover"
            loading="lazy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        </div>
      ) : (
        <div className="w-full h-40 sm:h-44 md:h-48 lg:h-52 bg-gray-200 flex items-center justify-center">
          <span className="text-gray-400 text-base sm:text-lg">No Image</span>
        </div>
      )}

      {/* Shop Info */}
      <div className={`p-3 sm:p-4 md:p-5 flex-1 flex flex-col ${highlighted ? 'text-white' : ''}`}>
        <div className="flex flex-row items-center justify-between mb-2">
          <h4 className={`text-base sm:text-lg md:text-xl font-bold flex-1 ${highlighted ? 'text-white' : 'text-gray-800'} truncate`}>
            {shop.name}
          </h4>
          <ShopRating shopId={shop.id} highlighted={highlighted} />
        </div>

        {/* Delivery Fee and Time */}
        <div className="flex flex-row items-center justify-between mb-3">
          <span className={highlighted ? 'text-white/80 text-sm' : 'text-gray-600 text-sm'}>
            {shopTypeLabel || '—'}
          </span>
          <span className={highlighted ? 'text-white font-semibold' : 'text-blue-600 font-semibold'}>
            {shop.delivery_fee > 0 ? `Rs ${shop.delivery_fee.toFixed(0)}` : 'N/A'}
          </span>
        </div>

        {/* Tags */}
        <div className="flex flex-row flex-wrap gap-2">
          {shop.tags.map((tag, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.05 }}
              className={`px-3 py-1 rounded-full transition-colors ${
                highlighted ? 'bg-white/20 hover:bg-white/30' : 'bg-blue-50 hover:bg-blue-100'
              }`}
            >
              <span className={`${highlighted ? 'text-white' : 'text-blue-600'} text-xs font-medium`}>
                {tag}
              </span>
            </motion.div>
          ))}
          {isClosed && (
            <div className="bg-gray-200 px-3 py-1 rounded-full">
              <span className="text-gray-700 text-xs font-medium">Closed</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

