import React, { useState, useEffect, useRef } from 'react';
import { cancelOrder } from '../../../src/services/consumer/orderService';
import type { OrderWithAll, OrderStatus } from '../../../src/types/orders';
import { useOrderApproval } from '../context/OrderApprovalContext';
import OrderApprovalContent from './OrderApprovalContent';
import { useOrder } from '../../../src/hooks/consumer/useOrder';

interface OrderApprovalModalProps {
  order: OrderWithAll;
  onClose: () => void;
}

const STATUS_STEPS: { status: OrderStatus; label: string; icon: string }[] = [
  { status: 'pending', label: 'Order Placed', icon: '📦' },
  { status: 'confirmed', label: 'Order Confirmed', icon: '✅' },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: '🚚' },
  { status: 'delivered', label: 'Delivered', icon: '🎉' },
];

export default function OrderApprovalModal({ order: initialOrder, onClose }: OrderApprovalModalProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [countdown, setCountdown] = useState<string>('00:00');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date>(new Date(initialOrder.placed_at || initialOrder.created_at || new Date().toISOString()));
  const { setActiveOrder, setShowThankYou, setReviewOrder } = useOrderApproval();

  // Use shared hook for real-time order updates (same as full screen view)
  const { data: liveOrder, isLoading: orderLoading } = useOrder(initialOrder.id);
  const order = (liveOrder || initialOrder) as OrderWithAll;

  // Get current status step index
  const currentStepIndex = STATUS_STEPS.findIndex((step) => step.status === order.status);
  const activeStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  // Keep active order in context in sync with live data for the notification bell
  useEffect(() => {
    if (!order) return;
    if (order.status === 'delivered' || order.status === 'cancelled') {
      setActiveOrder(null);
    } else {
      setActiveOrder(order);
    }
  }, [order?.id, order?.status, setActiveOrder]);

  // Countdown timer
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = new Date();
      const startTime = startTimeRef.current;
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedSeconds(diff);

      // Format as MM:SS
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      setCountdown(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Stop timer if order is in terminal state
  useEffect(() => {
    if (order.status === 'delivered' || order.status === 'cancelled') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, [order.status]);

  const formatStatus = (status: string) =>
    status
      .replace(/_/g, ' ')
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

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

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '--';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const handleGetDirections = () => {
    if (!order.delivery_address) {
      return;
    }

    // Handle both number and string types for latitude/longitude (JSONB can store as either)
    const destLat = typeof order.delivery_address.latitude === 'number' 
      ? order.delivery_address.latitude 
      : parseFloat(String(order.delivery_address.latitude || 0));
    const destLng = typeof order.delivery_address.longitude === 'number'
      ? order.delivery_address.longitude
      : parseFloat(String(order.delivery_address.longitude || 0));

    if (isNaN(destLat) || isNaN(destLng) || destLat === 0 || destLng === 0) {
      console.error('Invalid coordinates for delivery address');
      return;
    }

    // Build Google Maps directions URL to delivery address
    // Google Maps will automatically use the user's current location as origin if available
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;

    // Open Google Maps in a new tab
    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    setCancelError(null);

    try {
      const result = await cancelOrder(order.id, 'Cancelled by customer');
      if (result.success) {
        // Optimistically update the order status immediately
        // Immediately clear from notifications when cancelled;
        // React Query + realtime will update any listeners.
        setActiveOrder(null);
        setShowCancelConfirm(false);
        
        // Real-time subscription will update the order automatically
        // Auto-close modal after 1.5 seconds to show cancelled status
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setCancelError(result.message || 'Failed to cancel order');
        setCancelling(false);
      }
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Failed to cancel order');
      setCancelling(false);
    }
    // Note: Don't set cancelling to false on success - let the real-time update handle it
  };

  // Allow cancellation for any non-terminal status.
  // Terminal statuses: delivered, cancelled.
  const canCancelOrder = order.status !== 'delivered' && order.status !== 'cancelled';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <OrderApprovalContent
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
          onClose={onClose}
        />
      </div>
    </div>
  );
}

