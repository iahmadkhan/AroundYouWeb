import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { OrderWithAll, OrderStatus } from '../../../src/types/orders';

type Props = {
  order: OrderWithAll;
  countdown: string;
  elapsedSeconds: number;
  activeStepIndex: number;
  STATUS_STEPS: { status: OrderStatus; label: string; icon: string }[];
  formatTime: (s: number) => string;
  getStatusColor: (s: string) => string;
  formatStatus: (s: string) => string;
  handleGetDirections: () => void;
  canCancelOrder: boolean;
  showCancelConfirm: boolean;
  setShowCancelConfirm: (b: boolean) => void;
  cancelling: boolean;
  cancelError: string | null;
  handleCancelOrder: () => Promise<void>;
  onClose?: () => void;
  variant?: 'modal' | 'screen';
};

export default function OrderApprovalContent({
  order,
  countdown,
  elapsedSeconds,
  activeStepIndex,
  STATUS_STEPS,
  formatTime,
  getStatusColor,
  formatStatus,
  handleGetDirections,
  canCancelOrder,
  showCancelConfirm,
  setShowCancelConfirm,
  cancelling,
  cancelError,
  handleCancelOrder,
  onClose,
  variant = 'modal',
}: Props) {
  const navigate = useNavigate();
  const isScreen = variant === 'screen';
  const containerClasses = isScreen
    ? 'w-full'
    : 'bg-white rounded-2xl shadow-xl max-w-2xl w-full';
  const headerClasses = isScreen
    ? 'bg-white border-b border-gray-200 px-6 py-5'
    : 'sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10';

  // For long-running orders, hide the raw mm:ss countdown (e.g. 790:41)
  // and only show the friendly formatted duration (e.g. 13h 10m)
  const showRawCountdown = elapsedSeconds < 60 * 60; // show mm:ss only for first hour

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className={headerClasses + (isScreen ? '' : ' flex items-center justify-between')}>
        <div className={isScreen ? 'flex flex-col' : undefined}>
          <h2 className="text-2xl font-bold text-gray-900">Order Status</h2>
          <p className="text-sm text-gray-500 mt-1">
            Order #{order.order_number || order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        {!isScreen && onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold transition-colors"
          >
            ×
          </button>
        )}
      </div>

      <div className={isScreen ? 'p-6 md:p-8 space-y-6 md:space-y-8' : 'p-6 space-y-6'}>
        {/* Countdown Timer */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 md:p-7 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Time Elapsed</p>
              <p className="text-3xl md:text-4xl font-bold text-blue-600 font-mono">
                {showRawCountdown ? countdown : formatTime(elapsedSeconds)}
              </p>
              {showRawCountdown && (
                <p className="text-xs text-gray-500 mt-1">{formatTime(elapsedSeconds)}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Current Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(order.status)}`}>
                {formatStatus(order.status)}
              </span>
            </div>
          </div>
        </div>

        {/* Status Progress Steps */}
        <div className="space-y-4">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900">Order Progress</h3>
          <div className="space-y-4 relative">
            {STATUS_STEPS.map((step, index) => {
              // If activeStepIndex equals STATUS_STEPS.length, all steps are completed
              const isCompleted = index < activeStepIndex || activeStepIndex >= STATUS_STEPS.length;
              const isActive = index === activeStepIndex && activeStepIndex < STATUS_STEPS.length;
              return (
                <div key={step.status} className="flex items-start gap-4 relative">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-xl transition-all z-10 ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                          ? 'bg-blue-500 text-white animate-pulse'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isCompleted ? '✓' : step.icon}
                    </div>
                    {index < STATUS_STEPS.length - 1 && (
                      <div className={`w-0.5 h-8 md:h-10 mt-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  <div className="flex-1 pt-2">
                    <div className="flex items-center justify-between">
                      <p className={`font-semibold ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                      {isActive && <span className="text-xs text-blue-600 font-medium animate-pulse">In Progress</span>}
                      {isCompleted && <span className="text-xs text-green-600 font-medium">Completed</span>}
                    </div>
                    {isActive && order.status === step.status && (
                      <p className="text-sm text-gray-600 mt-1">
                        {step.status === 'out_for_delivery'
                          ? 'Your order is on the way.'
                          : 'Waiting for merchant to update order status...'}
                      </p>
                    )}
                    {/* Delivery runner details within progress when out for delivery */}
                    {step.status === 'out_for_delivery' && order.delivery_runner && (
                      <div className="mt-2 text-sm text-gray-700">
                        <span className="font-medium">Runner:</span>{' '}
                        <span>{order.delivery_runner.name || 'Assigned'}</span>
                        {order.delivery_runner.phone_number && (
                          <span className="ml-2 text-gray-600">
                            ({order.delivery_runner.phone_number})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Prominent Runner Info once dispatched */}
          {order.delivery_runner && (order.status === 'out_for_delivery' || order.status === 'delivered') && (
            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold shadow-sm">
                  {order.delivery_runner.name?.charAt(0).toUpperCase() || 'R'}
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                    Delivery Runner
                  </p>
                  <p className="text-sm text-blue-900 font-medium">
                    {order.delivery_runner.name || 'Assigned'}
                  </p>
                  {order.delivery_runner.phone_number && (
                    <p className="text-xs text-blue-800 mt-0.5">
                      {order.delivery_runner.phone_number}
                    </p>
                  )}
                </div>
              </div>
              {order.delivery_runner.phone_number && (
                <a
                  href={`tel:${order.delivery_runner.phone_number}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-full bg-white text-blue-700 text-xs font-semibold shadow-sm hover:bg-blue-600 hover:text-white transition-colors"
                >
                  Call
                </a>
              )}
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Summary</h3>
          <div className="space-y-2">
            {order.order_items && order.order_items.length > 0 && (
              <div className="space-y-2 mb-4">
                {order.order_items.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {item.item_name} × {item.quantity}
                    </span>
                    <span className="font-medium text-gray-900">
                      Rs {Math.round((item.subtotal_cents || 0) / 100).toLocaleString()}
                    </span>
                  </div>
                ))}
                {order.order_items.length > 3 && (
                  <p className="text-xs text-gray-400">
                    +{order.order_items.length - 3} more item{order.order_items.length - 3 === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>Rs {Math.round((order.total_cents || 0) / 100).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Shop Details */}
        {order.shop ? (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Shop Details</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                {order.shop.image_url ? (
                  <img
                    src={order.shop.image_url}
                    alt={order.shop.name || 'Shop'}
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                    onError={(e) => {
                      // Hide broken image
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-200 border border-gray-300 flex items-center justify-center">
                    <span className="text-2xl">🏪</span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-base">{order.shop.name || 'Shop'}</p>
                  {order.shop.shop_type && (
                    <p className="text-sm text-gray-600 mt-1 capitalize">{order.shop.shop_type}</p>
                  )}
                  {order.shop.address && (
                    <p className="text-sm text-gray-600 mt-1">{order.shop.address}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Show placeholder if shop data is missing (shouldn't happen but handle gracefully)
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Shop Details</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-lg bg-gray-200 border border-gray-300 flex items-center justify-center">
                  <span className="text-2xl">🏪</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-base">Shop</p>
                  <p className="text-sm text-gray-500 mt-1">Loading shop details...</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Address */}
        {order.delivery_address && (
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Delivery Address</h3>
              {/* On the full status screen, allow user to change address via the saved-addresses page in select-only mode */}
              {isScreen && (
                <button
                  type="button"
                  onClick={() => {
                    // Navigate immediately for faster loading
                    navigate('/consumeraddressmanagement', {
                      state: { selectMode: true, from: 'order-status', orderId: order.id },
                    });
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                >
                  Change address
                </button>
              )}
            </div>
            <div className="space-y-2">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="font-semibold text-gray-900 text-base">
                  {order.delivery_address.street_address || 'Delivery address'}
                </p>
                {order.delivery_address.landmark && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Landmark:</span> {order.delivery_address.landmark}
                  </p>
                )}
                <p className="text-sm text-gray-600 mt-1">
                  {order.delivery_address.city || ''}
                  {order.delivery_address.region && `, ${order.delivery_address.region}`}
                </p>
                {order.delivery_address.formatted_address && (
                  <p className="text-xs text-gray-500 mt-2 italic">
                    {order.delivery_address.formatted_address}
                  </p>
                )}
              </div>
              {order.delivery_address.latitude && order.delivery_address.longitude && (
                <button
                  onClick={handleGetDirections}
                  className="w-full mt-3 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Get Directions
                </button>
              )}
            </div>
          </div>
        )}

        {/* Order Information */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Method</span>
              <span className="font-medium text-gray-900 capitalize">{order.payment_method || '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Placed At</span>
              <span className="font-medium text-gray-900">{new Date(order.placed_at || order.created_at || '').toLocaleString()}</span>
            </div>
            {order.confirmed_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Confirmed At</span>
                <span className="font-medium text-gray-900">{new Date(order.confirmed_at).toLocaleString()}</span>
              </div>
            )}
            {order.out_for_delivery_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Out for Delivery At</span>
                <span className="font-medium text-gray-900">{new Date(order.out_for_delivery_at).toLocaleString()}</span>
              </div>
            )}
            {order.delivered_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Delivered At</span>
                <span className="font-medium text-gray-900">{new Date(order.delivered_at).toLocaleString()}</span>
              </div>
            )}
            {order.special_instructions && (
              <div className="pt-2 border-t border-gray-200">
                <span className="text-gray-600 block mb-1">Special Instructions</span>
                <span className="font-medium text-gray-900">{order.special_instructions}</span>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Runner Info */}
        {order.delivery_runner && order.status === 'out_for_delivery' && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Delivery Runner</h3>
            <div className="space-y-2">
              <p className="font-semibold text-gray-900 text-base">{order.delivery_runner.name}</p>
              {order.delivery_runner.phone_number && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Phone:</span> {order.delivery_runner.phone_number}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Cancel Order Section */}
        {canCancelOrder && (
          <div className="border-t border-gray-200 pt-4">
            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-md hover:shadow-lg"
              >
                Cancel Order
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 font-medium">
                  Are you sure you want to cancel this order?
                </p>
                {cancelError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600">{cancelError}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelOrder}
                    disabled={cancelling}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelling ? 'Cancelling...' : 'Yes, Cancel Order'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCancelConfirm(false);
                    }}
                    disabled={cancelling}
                    className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    No, Keep Order
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer (modal only) */}
      {!isScreen && onClose && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}


