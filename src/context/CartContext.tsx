import React, { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useCartStore, CartItem, ShopCart } from '../stores/cartStore';
import { useAuth } from './AuthContext';

type CartContextValue = {
  items: CartItem[]; // All items from all shops (for backward compatibility)
  shopId: string | null; // Current shop ID
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (shopId: string, itemId: string) => void;
  updateQuantity: (shopId: string, itemId: string, quantity: number) => void;
  clearCart: (shopId?: string) => void;
  getTotalPrice: (shopId?: string) => number;
  getItemCount: (shopId?: string) => number;
  getItemQuantity: (shopId: string, itemId: string) => number;
  getAllItems: () => CartItem[];
  getShopIds: () => string[];
  getShopCart: (shopId: string) => ShopCart | null;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

// Internal component to handle user sync - must be inside AuthProvider
// Since CartProvider is inside AuthProvider in the component tree, useAuth() should work
function CartUserSync() {
  const setUserId = useCartStore((state) => state.setUserId);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Wait for auth to finish loading before syncing user ID
    // This prevents clearing the cart during initial auth check
    if (authLoading) {
      return;
    }
    
    const userId = user?.id || null;
    setUserId(userId);
  }, [user?.id, authLoading, setUserId]);

  return null;
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Use selectors to get only what we need, preventing unnecessary re-renders
  const currentShopId = useCartStore((state) => state.currentShopId);
  const shopCarts = useCartStore((state) => state.shopCarts);
  
  // Get functions directly - these are stable references
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const getTotalPrice = useCartStore((state) => state.getTotalPrice);
  const getItemCount = useCartStore((state) => state.getItemCount);
  const getItemQuantity = useCartStore((state) => state.getItemQuantity);
  const getAllItems = useCartStore((state) => state.getAllItems);
  const getShopIds = useCartStore((state) => state.getShopIds);
  const getShopCart = useCartStore((state) => state.getShopCart);

  // Get all items for backward compatibility - only recompute when shopCarts change
  const items = useMemo(() => {
    return Object.values(shopCarts).flatMap((shopCart) => shopCart.items);
  }, [shopCarts]);

  const value: CartContextValue = {
    items,
    shopId: currentShopId,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getItemCount,
    getItemQuantity,
    getAllItems,
    getShopIds,
    getShopCart,
  };

  // Render CartUserSync separately to prevent it from blocking children if it throws
  // Wrap it in React.Suspense and ErrorBoundary to handle errors gracefully
  return (
    <CartContext.Provider value={value}>
      {children}
      <React.Suspense fallback={null}>
        <CartUserSync />
      </React.Suspense>
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

