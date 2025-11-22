import React, { useState, useEffect } from 'react';
import { Save, Info } from 'lucide-react';
import { supabase } from '../../../../src/services/supabase';
import type { DeliveryLogicPayload } from '../../../../src/services/merchant/deliveryLogicService';

interface DeliveryLogicPageProps {
  shopId?: string;
}

export default function DeliveryLogicPage({ shopId }: DeliveryLogicPageProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<DeliveryLogicPayload>({
    minimumOrderValue: 200,
    smallOrderSurcharge: 40,
    leastOrderValue: 100,
    distanceMode: 'auto',
    maxDeliveryFee: 130,
    beyondTierFeePerUnit: 10,
    beyondTierDistanceUnit: 250,
    freeDeliveryThreshold: 800,
    freeDeliveryRadius: 1000,
  });

  useEffect(() => {
    if (shopId) {
      loadDeliveryLogic();
    }
  }, [shopId]);

  const loadDeliveryLogic = async () => {
    if (!shopId) return;
    
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('shop_delivery_logic')
        .select('*')
        .eq('shop_id', shopId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading delivery logic:', fetchError);
        return;
      }

      if (data) {
        const row = data as any;
        setFormData({
          minimumOrderValue: Number(row.minimum_order_value) || 200,
          smallOrderSurcharge: Number(row.small_order_surcharge) || 40,
          leastOrderValue: Number(row.least_order_value) || 100,
          distanceMode: row.distance_mode || 'auto',
          maxDeliveryFee: Number(row.max_delivery_fee) || 130,
          beyondTierFeePerUnit: Number(row.beyond_tier_fee_per_unit) || 10,
          beyondTierDistanceUnit: Number(row.beyond_tier_distance_unit) || 250,
          freeDeliveryThreshold: Number(row.free_delivery_threshold) || 800,
          freeDeliveryRadius: Number(row.free_delivery_radius) || 1000,
        });
      }
    } catch (error) {
      console.error('Error loading delivery logic:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!shopId) return;

    // Validation
    if (formData.leastOrderValue! > formData.minimumOrderValue!) {
      setError('Least order value cannot be greater than minimum order value');
      return;
    }

    if (formData.minimumOrderValue! <= 0 || formData.leastOrderValue! <= 0) {
      setError('Order values must be greater than 0');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Check if delivery logic exists
      const { data: existingData } = await supabase
        .from('shop_delivery_logic')
        .select('id')
        .eq('shop_id', shopId)
        .maybeSingle();
      
      const existing = existingData as { id: string } | null;

      const updateData: any = {
        minimum_order_value: formData.minimumOrderValue,
        small_order_surcharge: formData.smallOrderSurcharge,
        least_order_value: formData.leastOrderValue,
        distance_mode: formData.distanceMode,
        max_delivery_fee: formData.maxDeliveryFee,
        beyond_tier_fee_per_unit: formData.beyondTierFeePerUnit,
        beyond_tier_distance_unit: formData.beyondTierDistanceUnit,
        free_delivery_threshold: formData.freeDeliveryThreshold,
        free_delivery_radius: formData.freeDeliveryRadius,
      };

      if (existing) {
        // Update existing
        const { error: updateError } = await (supabase
          .from('shop_delivery_logic') as any)
          .update(updateData)
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Create new
        const { error: createError } = await (supabase
          .from('shop_delivery_logic') as any)
          .insert({
            shop_id: shopId,
            ...updateData,
          });

        if (createError) throw createError;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error saving delivery logic:', error);
      setError(error.message || 'Failed to save delivery logic');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading delivery logic...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Delivery Logic</h2>
          <p className="text-gray-600">Configure order value requirements and delivery fee calculations</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-green-600 text-sm">Delivery logic saved successfully!</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          {/* Order Value Layer */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900">Order Value Layer</h3>
              <Info size={16} className="text-gray-400" />
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Minimum Order Value (PKR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.minimumOrderValue}
                  onChange={(e) => setFormData({ ...formData, minimumOrderValue: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="200"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">Orders below this value will incur a surcharge</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Small Order Surcharge (PKR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.smallOrderSurcharge}
                  onChange={(e) => setFormData({ ...formData, smallOrderSurcharge: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="40"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">Additional fee for orders below minimum order value</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Least Order Value (PKR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.leastOrderValue}
                  onChange={(e) => setFormData({ ...formData, leastOrderValue: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="100"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">Absolute minimum order value allowed</p>
              </div>
            </div>
          </div>

          {/* Distance Layer */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900">Distance Layer</h3>
              <Info size={16} className="text-gray-400" />
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Distance Mode
                </label>
                <select
                  value={formData.distanceMode}
                  onChange={(e) => setFormData({ ...formData, distanceMode: e.target.value as 'auto' | 'custom' })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="auto">Auto</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Maximum Delivery Fee (PKR)
                </label>
                <input
                  type="number"
                  value={formData.maxDeliveryFee}
                  onChange={(e) => setFormData({ ...formData, maxDeliveryFee: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="130"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Beyond Tier Fee Per Unit (PKR)
                </label>
                <input
                  type="number"
                  value={formData.beyondTierFeePerUnit}
                  onChange={(e) => setFormData({ ...formData, beyondTierFeePerUnit: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="10"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">Fee charged per distance unit beyond the last tier</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Beyond Tier Distance Unit (meters)
                </label>
                <input
                  type="number"
                  value={formData.beyondTierDistanceUnit}
                  onChange={(e) => setFormData({ ...formData, beyondTierDistanceUnit: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="250"
                  min="0"
                  step="1"
                />
                <p className="text-xs text-gray-500 mt-1">Distance unit for calculating beyond-tier fees</p>
              </div>
            </div>
          </div>

          {/* Free Delivery Layer */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900">Free Delivery Discount Layer</h3>
              <Info size={16} className="text-gray-400" />
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Free Delivery Threshold (PKR)
                </label>
                <input
                  type="number"
                  value={formData.freeDeliveryThreshold}
                  onChange={(e) => setFormData({ ...formData, freeDeliveryThreshold: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="800"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum order value to qualify for free delivery</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Free Delivery Radius (meters)
                </label>
                <input
                  type="number"
                  value={formData.freeDeliveryRadius}
                  onChange={(e) => setFormData({ ...formData, freeDeliveryRadius: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1000"
                  min="0"
                  step="1"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum distance for free delivery</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save Delivery Logic'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

