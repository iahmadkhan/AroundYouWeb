import React, { useEffect, useRef, useState, useMemo, useCallback, startTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { OrderWithAll, OrderStatus } from '../../../src/types/orders';
import { useOrder } from '../../../src/hooks/consumer/useOrder';
import { cancelOrder } from '../../../src/services/consumer/orderService';
import OrderApprovalContent from '../components/OrderApprovalContent';
import { useOrderApproval } from '../context/OrderApprovalContext';

const STATUS_STEPS: { status: OrderStatus; label: string; icon: string }[] = [
  { status: 'pending', label: 'Order Placed', icon: '📦' },
  { status: 'confirmed', label: 'Order Confirmed', icon: '✅' },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: '🚚' },
  { status: 'delivered', label: 'Delivered', icon: '🎉' },
];

export default function OrderStatusScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || undefined;

  // Use React Query hook with real-time subscription
  const { data: order, isLoading, refetch } = useOrder(orderId);

  const [countdown, setCountdown] = useState('00:00');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  
  const startTimeRef = useRef<Date | null>(null);
  const navigateRef = useRef(navigate);
  const prevStatusRef = useRef<OrderStatus | null>(null);
  const { setShowThankYou, setReviewOrder, setActiveOrder, setShowModal } = useOrderApproval();
  
  // Keep navigate ref updated
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Track if we've already handled delivered transition to prevent duplicate calls
  const deliveredHandledRef = useRef<string | null>(null);
  
  // Handle delivered status transition - defined first so it can be used in updateOrderState
  const handleDeliveredTransition = useCallback((orderData: OrderWithAll) => {
    // Prevent duplicate handling
    if (deliveredHandledRef.current === orderData.id) {
      return;
    }
    deliveredHandledRef.current = orderData.id;
    
    console.log('🎉 Handling delivered transition for order:', orderData.id);
    
    // Use startTransition to batch state updates and prevent React queue errors
    startTransition(() => {
      try {
        const flagKey = `aroundyou_thankyou_shown_${orderData.id}`;
        const shown = typeof window !== 'undefined' ? localStorage.getItem(flagKey) : null;
        if (!shown) {
          console.log('✅ Showing Thank You modal for order:', orderData.id);
          localStorage.setItem(flagKey, 'true');
          setReviewOrder(orderData);
          setShowThankYou(true);
          // Navigate away from status screen after a short delay
          setTimeout(() => {
            navigateRef.current('/orders');
          }, 100);
        } else {
          console.log('ℹ️ Thank You modal already shown for order:', orderData.id);
        }
      } catch (error) {
        console.error('Error handling delivered transition:', error);
        // Still show modals even if localStorage fails
        setReviewOrder(orderData);
        setShowThankYou(true);
        setTimeout(() => {
          navigateRef.current('/orders');
        }, 100);
      }
    });
  }, [setReviewOrder, setShowThankYou]);

  // Watch for status changes and handle delivered transition
  useEffect(() => {
    if (!order) return;

    const currentStatus = order.status as OrderStatus;
    const previousStatus = prevStatusRef.current;

    // Reset delivered handled ref if order ID changed
    if (deliveredHandledRef.current && deliveredHandledRef.current !== order.id) {
      deliveredHandledRef.current = null;
    }

    // Update previous status ref
    if (previousStatus !== currentStatus) {
      console.log('📡 Order status changed:', previousStatus, '→', currentStatus);
      prevStatusRef.current = currentStatus;

      // Handle delivered transition
      if (currentStatus === 'delivered' && previousStatus !== 'delivered') {
        handleDeliveredTransition(order);
      }

      // Handle cancelled transition (regardless of where cancellation happened)
      if (currentStatus === 'cancelled' && previousStatus !== 'cancelled') {
        console.log('🛑 Order was cancelled, navigating away from status screen');
        // Use startTransition to batch state updates
        startTransition(() => {
          try {
            setShowThankYou(false);
            setReviewOrder(null);
            setActiveOrder(null);
            setShowModal(false);
          } catch (err) {
            console.error('Error cleaning up after cancellation:', err);
          }
        });
        setTimeout(() => {
          navigateRef.current('/orders');
        }, 100);
      }
    }

    // Update start time when order is first loaded
    if (order && (order.placed_at || order.created_at)) {
      const orderStartTime = new Date(order.placed_at || order.created_at || new Date().toISOString());
      if (!startTimeRef.current || startTimeRef.current.getTime() !== orderStartTime.getTime()) {
        startTimeRef.current = orderStartTime;
      }
    }
  }, [order, handleDeliveredTransition, setShowThankYou, setReviewOrder, setActiveOrder, setShowModal]);

  // Countdown timer
  useEffect(() => {
    if (!startTimeRef.current) return;
    
    const id = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - startTimeRef.current!.getTime()) / 1000);
      setElapsedSeconds(diff);
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      setCountdown(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);
    
    return () => clearInterval(id);
  }, [order?.placed_at, order?.created_at]);

  // Calculate active step index
  const activeStepIndex = useMemo(() => {
    if (!order) return 0;
    const statusIndex = STATUS_STEPS.findIndex((s) => s.status === order.status);
    if (statusIndex === -1) return 0;
    if (order.status === 'delivered') {
      return STATUS_STEPS.length; // All steps completed
    }
    return statusIndex;
  }, [order?.status]);

  // Loading state
  if (isLoading || !order) {
    return (
      <div className="min-h-[60vh] bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="h-20 w-20 rounded-2xl bg-gray-200 animate-pulse mb-6" />
          <div className="h-6 w-64 bg-gray-200 rounded mb-2 animate-pulse" />
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'confirmed':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'out_for_delivery':
        return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      case 'delivered':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'cancelled':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatStatus = (status: string) =>
    status
      .replace(/_/g, ' ')
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const handleGetDirections = () => {
    if (!order.delivery_address) return;
    const destLat = Number(order.delivery_address.latitude ?? 0);
    const destLng = Number(order.delivery_address.longitude ?? 0);
    if (isNaN(destLat) || isNaN(destLng) || destLat === 0 || destLng === 0) return;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
  };

  // Allow cancellation for any non-terminal status on the status screen
  const canCancelOrder = order.status !== 'delivered' && order.status !== 'cancelled';

  // Note: keep this as a plain async function (no useCallback) to avoid any
  // potential Hooks ordering quirks during hot reload in dev.
  const handleCancelOrder = async () => {
    if (!order) return;

    setCancelling(true);
    setCancelError(null);

    try {
      const result = await cancelOrder(order.id, 'Cancelled by customer');
      if (result.success) {
        console.log('🛑 Order cancelled from status screen, navigating away');
        // Use startTransition to batch state updates
        startTransition(() => {
          setShowCancelConfirm(false);
          setActiveOrder(null);
          setShowModal(false);
        });
        setTimeout(() => {
          navigateRef.current('/orders');
        }, 100);
      } else {
        setCancelError(result.message || 'Failed to cancel order');
        setCancelling(false);
      }
    } catch (err) {
      setCancelError(
        err instanceof Error ? err.message : 'Failed to cancel order'
      );
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page hero/header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Order Status</h1>
              <p className="text-sm text-gray-500 mt-1">
                Tracking order #{order.order_number || order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="hidden md:inline-flex px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
        <OrderApprovalContent
          key={`order-${order.id}-${order.status}`}
          order={order}
          countdown={countdown}
          elapsedSeconds={elapsedSeconds}
          activeStepIndex={activeStepIndex}
          STATUS_STEPS={STATUS_STEPS}
          formatTime={formatTime}
          getStatusColor={getStatusColor}
          formatStatus={formatStatus}
          handleGetDirections={handleGetDirections}
          canCancelOrder={canCancelOrder}
          showCancelConfirm={showCancelConfirm}
          setShowCancelConfirm={setShowCancelConfirm}
          cancelling={cancelling}
          cancelError={cancelError}
          handleCancelOrder={handleCancelOrder}
          variant="screen"
          onClose={() => navigate(-1)}
        />
      </div>
    </div>
  );
}
