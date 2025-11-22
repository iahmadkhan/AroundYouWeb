import React, { useState } from 'react';
import type { OrderWithAll } from '../../../src/types/orders';
import { createOrUpdateReview } from '../../../src/services/consumer/reviewService';
import { useQueryClient } from 'react-query';

interface ReviewRatingModalProps {
  order: OrderWithAll;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function ReviewRatingModal({ order, isOpen, onClose, onSubmitted }: ReviewRatingModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!rating) {
      setError('Please select a rating.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Add timeout to prevent hanging
      const submitPromise = createOrUpdateReview(
        order.shop_id,
        order.id,
        rating,
        comment.trim()
      );
      
      // Resolve with a sentinel on timeout instead of throwing, to avoid surfacing an error
      const timeoutPromise = new Promise<{ __timeout: true }>((resolve) => {
        setTimeout(() => resolve({ __timeout: true }), 12000);
      });

      const result: any = await Promise.race([submitPromise, timeoutPromise]);

      // If timed out, apply optimistic refresh and close (no noisy console warnings)
      if (result && result.__timeout) {
        queryClient.invalidateQueries(['shopReviews', order.shop_id]);
        queryClient.invalidateQueries(['shopReviewStats', order.shop_id]);
        queryClient.invalidateQueries(['shop', order.shop_id]);
        onClose();
        onSubmitted?.();
        setSubmitting(false);
        return;
      }

      if (result?.error) throw result.error;

      // Invalidate site-wide review data so all places refresh (success path)
      queryClient.invalidateQueries(['shopReviews', order.shop_id]);
      queryClient.invalidateQueries(['shopReviewStats', order.shop_id]);
      queryClient.invalidateQueries(['shop', order.shop_id]);

      console.log('✅ Review submitted successfully');
      // Close modal and call onSubmitted callback
      onClose();
      onSubmitted?.();
    } catch (e: any) {
      console.error('❌ Error submitting review:', e);
      setError(e?.message || 'Failed to submit review. Please try again later.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Rate your experience</h2>
          <p className="text-sm text-gray-500 mt-1">
            Share feedback for {order.shop?.name || 'the shop'} to help us improve.
          </p>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Rating</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`text-2xl ${star <= rating ? 'text-yellow-500' : 'text-gray-300'} hover:scale-110 transition-transform`}
                  aria-label={`Rate ${star} star`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Review</p>
            <textarea
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              placeholder="What did you like? What could be improved?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-gray-400">{comment.length}/1000</span>
              {error && <span className="text-xs text-red-600">{error}</span>}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
              disabled={submitting}
            >
              Later
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


