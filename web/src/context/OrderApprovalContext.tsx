import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { OrderWithAll } from '../../../src/types/orders';
import { getOrderById, getActiveOrder, subscribeToUserOrders } from '../../../src/services/consumer/orderService';
import { useAuth } from '../../../src/context/AuthContext';

interface OrderApprovalContextType {
  activeOrder: OrderWithAll | null;
  setActiveOrder: (order: OrderWithAll | null) => void;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  // Post-delivery prompts
  showThankYou: boolean;
  setShowThankYou: (show: boolean) => void;
  showReview: boolean;
  setShowReview: (show: boolean) => void;
  reviewOrder: OrderWithAll | null;
  setReviewOrder: (order: OrderWithAll | null) => void;
}

const OrderApprovalContext = createContext<OrderApprovalContextType | undefined>(undefined);

const STORAGE_KEY = 'aroundyou_active_order';
const STORAGE_MODAL_KEY = 'aroundyou_show_order_modal';

export function OrderApprovalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Initialize state from localStorage if available
  const [activeOrder, setActiveOrderState] = useState<OrderWithAll | null>(() => {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const order = JSON.parse(stored);
        // Only restore if order hasn't reached terminal state
        if (order && order.status !== 'delivered' && order.status !== 'cancelled') {
          return order;
        } else {
          // Clear stale data
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_MODAL_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading active order from localStorage:', error);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_MODAL_KEY);
    }
    return null;
  });

  // Post-delivery prompt states (not persisted)
  const [showThankYou, setShowThankYou] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<OrderWithAll | null>(null);

  // Initialize showModal based on localStorage and whether we have an active order
  // Note: activeOrder is initialized above, so we check localStorage directly
  const [showModal, setShowModalState] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    try {
      const stored = localStorage.getItem(STORAGE_MODAL_KEY);
      const hasStoredOrder = localStorage.getItem(STORAGE_KEY);
      return stored === 'true' && hasStoredOrder !== null;
    } catch (error) {
      return false;
    }
  });

  // Wrapper function to update activeOrder and persist to localStorage
  const setActiveOrder = (order: OrderWithAll | null) => {
    setActiveOrderState(order);
    
    if (typeof window !== 'undefined') {
      try {
        if (order) {
          // Only persist if order hasn't reached terminal state
          if (order.status !== 'delivered' && order.status !== 'cancelled') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
          } else {
            // Clear if terminal state
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_MODAL_KEY);
          }
        } else {
          // Clear when explicitly set to null
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_MODAL_KEY);
        }
      } catch (error) {
        console.error('Error saving active order to localStorage:', error);
      }
    }
  };

  // Wrapper function to update showModal and persist to localStorage
  const setShowModal = (show: boolean) => {
    setShowModalState(show);
    
    if (typeof window !== 'undefined') {
      try {
        if (show && activeOrder) {
          localStorage.setItem(STORAGE_MODAL_KEY, 'true');
        } else {
          localStorage.removeItem(STORAGE_MODAL_KEY);
        }
      } catch (error) {
        console.error('Error saving modal state to localStorage:', error);
      }
    }
  };

  // Use ref to track current activeOrder to avoid dependency issues in subscription
  const activeOrderRef = useRef<OrderWithAll | null>(activeOrder);
  
  // Keep ref in sync with state
  useEffect(() => {
    activeOrderRef.current = activeOrder;
  }, [activeOrder]);

  // Verify and refresh order on mount (in case it was cancelled/delivered while page was closed)
  useEffect(() => {
    if (!activeOrder) return;

    // Check if order is still valid (not in terminal state)
    if (activeOrder.status === 'delivered' || activeOrder.status === 'cancelled') {
      // Clear stale order
      setActiveOrder(null);
      setShowModal(false);
      return;
    }

    // Refresh order from server to get latest status (async, don't block render)
    // This ensures we have the latest order status after page reload
    getOrderById(activeOrder.id)
      .then((refreshedOrder) => {
        if (refreshedOrder) {
          // Update with fresh data
          setActiveOrder(refreshedOrder);
          
          // Clear if order reached terminal state while page was closed
          if (refreshedOrder.status === 'delivered' || refreshedOrder.status === 'cancelled') {
            setShowModal(false);
          }
        } else {
          // Order not found, clear it
          setActiveOrder(null);
          setShowModal(false);
        }
      })
      .catch((error) => {
        console.error('Error refreshing active order:', error);
        // Keep the stored order if refresh fails
      });
  }, []); // Only run on mount

  // Global listener: keep activeOrder and post-delivery prompts in sync
  useEffect(() => {
    if (!user) return;
    
    // No debouncing, no delays - WebSocket is primary mechanism, updates are instant
    const unsubscribe = subscribeToUserOrders((ordersRaw) => {
      console.log('⚡ OrderApprovalContext: User orders subscription update received - updating IMMEDIATELY');
      
      const orders = (ordersRaw || []) as OrderWithAll[];
      const currentActiveOrder = activeOrderRef.current;

      // If we have an activeOrder, check if it was updated in the new orders list
      if (currentActiveOrder) {
        const updatedActiveOrder = orders.find(o => o.id === currentActiveOrder.id);
        if (updatedActiveOrder) {
          // Update immediately if status or updated_at changed
          if (updatedActiveOrder.status !== currentActiveOrder.status || 
              updatedActiveOrder.updated_at !== currentActiveOrder.updated_at) {
            console.log('⚡ OrderApprovalContext: Active order updated, status:', updatedActiveOrder.status);
            setActiveOrder(updatedActiveOrder);
            
            // Auto close modal if terminal state
            if (updatedActiveOrder.status === 'delivered' || updatedActiveOrder.status === 'cancelled') {
              setShowModal(false);
            }
          }
        } else {
          // Active order not in list anymore (delivered/cancelled), clear it
          console.log('⚡ OrderApprovalContext: Active order no longer in list, clearing');
          setActiveOrder(null);
          setShowModal(false);
        }
      }

      // Determine latest non-terminal active order for the bell icon
      const activeCandidates = orders
        .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
        .sort((a, b) => {
          const aTime = new Date(a.placed_at || a.created_at || '').getTime();
          const bTime = new Date(b.placed_at || b.created_at || '').getTime();
          return bTime - aTime;
        });

      const latestActive = activeCandidates[0] || null;
      
      // Only update if we don't already have an activeOrder or if it's different
      if (!currentActiveOrder || (latestActive && latestActive.id !== currentActiveOrder.id)) {
        setActiveOrder(latestActive || null);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, showThankYou, showReview, reviewOrder]); // Removed activeOrder from deps to prevent loops

  // When user logs in and we don't have an activeOrder yet, fetch the latest one from backend
  useEffect(() => {
    if (!user) {
      // Clear any local active order when logged out
      setActiveOrder(null);
      setShowModal(false);
      return;
    }

    // If we already have an active order (from localStorage or realtime), don't override it
    if (activeOrder) return;

    let isCancelled = false;

    getActiveOrder()
      .then((order) => {
        if (isCancelled) return;
        if (order && order.status !== 'delivered' && order.status !== 'cancelled') {
          setActiveOrder(order);
        } else {
          setActiveOrder(null);
          setShowModal(false);
        }
      })
      .catch((error) => {
        console.error('Error fetching active order on login:', error);
      });

    return () => {
      isCancelled = true;
    };
    // We intentionally exclude setActiveOrder/setShowModal from deps to avoid unnecessary re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeOrder?.id]);

  return (
    <OrderApprovalContext.Provider
      value={{
        activeOrder,
        setActiveOrder,
        showModal,
        setShowModal,
        showThankYou,
        setShowThankYou,
        showReview,
        setShowReview,
        reviewOrder,
        setReviewOrder,
      }}
    >
      {children}
    </OrderApprovalContext.Provider>
  );
}

export function useOrderApproval() {
  const context = useContext(OrderApprovalContext);
  if (context === undefined) {
    // Provide safe no-op defaults to avoid crashing if used outside provider
    return {
      activeOrder: null,
      setActiveOrder: () => {},
      showModal: false,
      setShowModal: () => {},
      showThankYou: false,
      setShowThankYou: () => {},
      showReview: false,
      setShowReview: () => {},
      reviewOrder: null,
      setReviewOrder: () => {},
    } as OrderApprovalContextType;
  }
  return context;
}

