import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartItem {
  id: string;
  shopId: string;
  shopName: string;
  name: string;
  description?: string;
  image_url?: string;
  price_cents: number;
  quantity: number;
}

export interface ShopCart {
  shopId: string;
  shopName: string;
  items: CartItem[];
}

interface CartState {
  shopCarts: Record<string, ShopCart>; // Map of shopId -> ShopCart
  currentShopId: string | null; // Currently active shop for adding items
  currentUserId: string | null; // Current user ID to track user changes
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (shopId: string, itemId: string) => void;
  updateQuantity: (shopId: string, itemId: string, quantity: number) => void;
  clearCart: (shopId?: string) => void; // Clear specific shop or all carts
  setUserId: (userId: string | null) => void; // Set user ID and clear cart if user changed
  getTotalPrice: (shopId?: string) => number; // Total for specific shop or all shops
  getItemCount: (shopId?: string) => number; // Count for specific shop or all shops
  getItemQuantity: (shopId: string, itemId: string) => number;
  getAllItems: () => CartItem[]; // Get all items from all shops
  getShopIds: () => string[]; // Get list of shop IDs with items
  getShopCart: (shopId: string) => ShopCart | null;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      shopCarts: {},
      currentShopId: null,
      currentUserId: null,
      addItem: (item) => {
        const state = get();
        const shopId = item.shopId;
        
        // Get or create shop cart
        let shopCart = state.shopCarts[shopId];
        if (!shopCart) {
          shopCart = {
            shopId,
            shopName: item.shopName,
            items: [],
          };
        }
        
        // Find existing item index for faster lookup
        const existingItemIndex = shopCart.items.findIndex((i) => i.id === item.id);
        
        if (existingItemIndex >= 0) {
          // Increase quantity if item already exists - update in place for performance
          const updatedItems = [...shopCart.items];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity + 1,
          };
          shopCart = { ...shopCart, items: updatedItems };
        } else {
          // Add new item with quantity 1
          shopCart = {
            ...shopCart,
            items: [...shopCart.items, { ...item, quantity: 1 }],
          };
        }
        
        // Update state immediately - Zustand will handle persistence asynchronously
        set({
          shopCarts: { ...state.shopCarts, [shopId]: shopCart },
          currentShopId: shopId,
        });
      },
      removeItem: (shopId, itemId) => {
        const state = get();
        const shopCart = state.shopCarts[shopId];
        if (!shopCart) return;
        
        const newItems = shopCart.items.filter((i) => i.id !== itemId);
        
        if (newItems.length === 0) {
          // Remove shop cart if empty
          const { [shopId]: removed, ...rest } = state.shopCarts;
          set({
            shopCarts: rest,
            currentShopId: Object.keys(rest).length > 0 ? state.currentShopId : null,
          });
        } else {
          set({
            shopCarts: {
              ...state.shopCarts,
              [shopId]: { ...shopCart, items: newItems },
            },
          });
        }
      },
      updateQuantity: (shopId, itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(shopId, itemId);
          return;
        }
        const state = get();
        const shopCart = state.shopCarts[shopId];
        if (!shopCart) return;
        
        // Find item index for faster update
        const itemIndex = shopCart.items.findIndex((i) => i.id === itemId);
        if (itemIndex < 0) return;
        
        // Update in place for better performance
        const updatedItems = [...shopCart.items];
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], quantity };
        
        // Update state immediately
        set({
          shopCarts: {
            ...state.shopCarts,
            [shopId]: {
              ...shopCart,
              items: updatedItems,
            },
          },
        });
      },
      clearCart: (shopId) => {
        const state = get();
        if (shopId) {
          // Clear specific shop
          const { [shopId]: removed, ...rest } = state.shopCarts;
          set({
            shopCarts: rest,
            currentShopId: Object.keys(rest).length > 0 ? state.currentShopId : null,
          });
        } else {
          // Clear all carts
          set({ shopCarts: {}, currentShopId: null });
        }
      },
      setUserId: (userId) => {
        const state = get();
        
        // If this is the initial state (no userId set yet), just set it without clearing
        if (state.currentUserId === null && userId !== null) {
          // Initial login - just set the user ID, don't clear cart
          set({ currentUserId: userId });
          return;
        }
        
        // If user changed (different user logged in), clear the cart
        if (state.currentUserId !== null && state.currentUserId !== userId && userId !== null) {
          // Different user - clear their cart
          set({ shopCarts: {}, currentShopId: null, currentUserId: userId });
        } else if (state.currentUserId !== null && userId === null) {
          // User logged out - clear cart
          set({ shopCarts: {}, currentShopId: null, currentUserId: null });
        } else if (state.currentUserId === userId) {
          // Same user - no change needed, but ensure user ID is set
          set({ currentUserId: userId });
        } else {
          // Edge case: userId is null but we had a user before
          // This might happen during auth loading - don't clear yet
          // Only clear if we're certain the user logged out (not just loading)
          if (state.currentUserId !== null) {
            // Keep the cart for now, but update user ID
            // The cart will be cleared when auth fully loads and confirms no user
            set({ currentUserId: userId });
          }
        }
      },
      getTotalPrice: (shopId) => {
        const state = get();
        if (shopId) {
          const shopCart = state.shopCarts[shopId];
          if (!shopCart) return 0;
          return shopCart.items.reduce((total, item) => total + item.price_cents * item.quantity, 0);
        } else {
          // Total for all shops
          return Object.values(state.shopCarts).reduce((total, shopCart) => {
            return total + shopCart.items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
          }, 0);
        }
      },
      getItemCount: (shopId) => {
        const state = get();
        if (shopId) {
          const shopCart = state.shopCarts[shopId];
          if (!shopCart) return 0;
          return shopCart.items.reduce((count, item) => count + item.quantity, 0);
        } else {
          // Count for all shops
          return Object.values(state.shopCarts).reduce((count, shopCart) => {
            return count + shopCart.items.reduce((sum, item) => sum + item.quantity, 0);
          }, 0);
        }
      },
      getItemQuantity: (shopId, itemId) => {
        const state = get();
        const shopCart = state.shopCarts[shopId];
        if (!shopCart) return 0;
        const item = shopCart.items.find((i) => i.id === itemId);
        return item?.quantity || 0;
      },
      getAllItems: () => {
        const state = get();
        return Object.values(state.shopCarts).flatMap((shopCart) => shopCart.items);
      },
      getShopIds: () => {
        const state = get();
        return Object.keys(state.shopCarts);
      },
      getShopCart: (shopId) => {
        const state = get();
        return state.shopCarts[shopId] || null;
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => localStorage),
      // Use partialize to only persist what we need (functions are not persisted)
      partialize: (state) => ({
        shopCarts: state.shopCarts,
        currentShopId: state.currentShopId,
        currentUserId: state.currentUserId,
      }),
    }
  )
);

