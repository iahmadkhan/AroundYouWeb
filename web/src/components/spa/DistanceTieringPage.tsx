import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Info } from 'lucide-react';
import { supabase } from '../../../../src/services/supabase';
import type { DistanceTier } from '../../../../src/services/merchant/deliveryLogicService';

interface DistanceTieringPageProps {
  shopId?: string;
}

export default function DistanceTieringPage({ shopId }: DistanceTieringPageProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [distanceTiers, setDistanceTiers] = useState<DistanceTier[]>([]);
  const [distanceMode, setDistanceMode] = useState<'auto' | 'custom'>('auto');

  useEffect(() => {
    if (shopId) {
      loadDistanceTiers();
    }
  }, [shopId]);

  const loadDistanceTiers = async () => {
    if (!shopId) return;
    
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('shop_delivery_logic')
        .select('distance_tiers, distance_mode')
        .eq('shop_id', shopId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading distance tiers:', fetchError);
        return;
      }

      if (data) {
        const row = data as any;
        // Set distance mode (default to 'auto' if not set)
        setDistanceMode(row.distance_mode || 'auto');
        
        if (row.distance_tiers) {
          setDistanceTiers(row.distance_tiers);
        } else {
          // Default tiers
          setDistanceTiers([
            { max_distance: 200, fee: 20 },
            { max_distance: 400, fee: 30 },
            { max_distance: 600, fee: 40 },
            { max_distance: 800, fee: 50 },
            { max_distance: 1000, fee: 60 },
          ]);
        }
      } else {
        // No data exists, use defaults
        setDistanceMode('auto');
        setDistanceTiers([
          { max_distance: 200, fee: 20 },
          { max_distance: 400, fee: 30 },
          { max_distance: 600, fee: 40 },
          { max_distance: 800, fee: 50 },
          { max_distance: 1000, fee: 60 },
        ]);
      }
    } catch (error) {
      console.error('Error loading distance tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTier = () => {
    const lastTier = distanceTiers[distanceTiers.length - 1];
    const newMaxDistance = lastTier ? lastTier.max_distance + 200 : 200;
    const newFee = lastTier ? lastTier.fee + 10 : 20;
    
    setDistanceTiers([...distanceTiers, { max_distance: newMaxDistance, fee: newFee }]);
  };

  const handleRemoveTier = (index: number) => {
    if (distanceTiers.length <= 1) {
      setError('At least one distance tier is required');
      return;
    }
    setDistanceTiers(distanceTiers.filter((_, i) => i !== index));
    setError(null);
  };

  const handleUpdateTier = (index: number, field: 'max_distance' | 'fee', value: number) => {
    const updated = [...distanceTiers];
    updated[index] = { ...updated[index], [field]: value };
    
    // Validate: max_distance should be in ascending order
    if (field === 'max_distance' && index > 0 && value <= updated[index - 1].max_distance) {
      setError('Distance must be greater than the previous tier');
      return;
    }
    if (field === 'max_distance' && index < updated.length - 1 && value >= updated[index + 1].max_distance) {
      setError('Distance must be less than the next tier');
      return;
    }
    
    setDistanceTiers(updated);
    setError(null);
  };

  const handleSave = async () => {
    if (!shopId) return;

    if (distanceMode === 'custom') {
      if (distanceTiers.length === 0) {
        setError('At least one distance tier is required');
        return;
      }

      // Validate tiers are in ascending order
      for (let i = 1; i < distanceTiers.length; i++) {
        if (distanceTiers[i].max_distance <= distanceTiers[i - 1].max_distance) {
          setError('Distance tiers must be in ascending order');
          return;
        }
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Check if delivery logic exists
      const { data: existing } = await supabase
        .from('shop_delivery_logic')
        .select('id')
        .eq('shop_id', shopId)
        .maybeSingle();

      const updateData: any = {
        distance_mode: distanceMode,
      };

      if (distanceMode === 'custom') {
        updateData.distance_tiers = distanceTiers;
      }

      if (existing) {
        const existingRow = existing as any;
        // Update existing
        const { error: updateError } = await (supabase
          .from('shop_delivery_logic') as any)
          .update(updateData)
          .eq('id', existingRow.id);

        if (updateError) throw updateError;
      } else {
        // Create new with default values
        const { error: createError } = await supabase
          .from('shop_delivery_logic')
          .insert({
            shop_id: shopId,
            minimum_order_value: 200,
            small_order_surcharge: 40,
            least_order_value: 100,
            ...updateData,
          } as any);

        if (createError) throw createError;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error saving distance tiers:', error);
      setError(error.message || 'Failed to save distance tiers');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToCustom = () => {
    setDistanceMode('custom');
  };

  const handleSwitchToAuto = () => {
    setDistanceMode('auto');
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading distance tiers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Distance Tiering</h2>
          <p className="text-gray-600">Configure delivery fees based on distance from your shop</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-green-600 text-sm">Distance tiers saved successfully!</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Mode Selection */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Distance Tiering Mode</h3>
                <p className="text-sm text-gray-600">
                  {distanceMode === 'auto' 
                    ? 'Automatic distance-based pricing is enabled. The system will calculate delivery fees based on distance automatically.'
                    : 'Custom distance tiers are enabled. You can manually configure distance ranges and fees.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {distanceMode === 'auto' ? (
                  <button
                    onClick={handleSwitchToCustom}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
                  >
                    Switch to Custom
                  </button>
                ) : (
                  <button
                    onClick={handleSwitchToAuto}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-all"
                  >
                    Switch to Auto
                  </button>
                )}
              </div>
            </div>
          </div>

          {distanceMode === 'auto' ? (
            <div className="py-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Info size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Automatic Distance Tiering</h3>
              <p className="text-gray-600 mb-4 max-w-md mx-auto">
                Your delivery fees are automatically calculated based on distance. The system uses intelligent algorithms to determine the optimal pricing for each delivery distance.
              </p>
              <p className="text-sm text-gray-500">
                To customize your distance tiers, click "Switch to Custom" above.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900">Distance Tiers</h3>
                  <Info size={16} className="text-gray-400" />
                </div>
                <button
                  onClick={handleAddTier}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
                >
                  <Plus size={18} />
                  Add Tier
                </button>
              </div>

              <div className="space-y-4">
                {distanceTiers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No distance tiers configured.</p>
                    <p className="text-sm mt-2">Click "Add Tier" to create your first tier.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="col-span-5 font-semibold text-gray-900 text-sm">Distance Range (meters)</div>
                      <div className="col-span-5 font-semibold text-gray-900 text-sm">Delivery Fee (PKR)</div>
                      <div className="col-span-2 font-semibold text-gray-900 text-sm">Actions</div>
                    </div>
                    {distanceTiers.map((tier, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-12 gap-4 items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="col-span-5">
                          <div className="flex items-center gap-2">
                            {index > 0 && (
                              <span className="text-sm text-gray-500">
                                {distanceTiers[index - 1].max_distance + 1} - 
                              </span>
                            )}
                            <input
                              type="number"
                              value={tier.max_distance}
                              onChange={(e) => handleUpdateTier(index, 'max_distance', parseFloat(e.target.value) || 0)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Distance"
                              min={index > 0 ? distanceTiers[index - 1].max_distance + 1 : 0}
                              step="1"
                            />
                            <span className="text-sm text-gray-500">m</span>
                          </div>
                        </div>
                        <div className="col-span-5">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={tier.fee}
                              onChange={(e) => handleUpdateTier(index, 'fee', parseFloat(e.target.value) || 0)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Fee"
                              min="0"
                              step="0.01"
                            />
                            <span className="text-sm text-gray-500">PKR</span>
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
                          <button
                            onClick={() => handleRemoveTier(index)}
                            disabled={distanceTiers.length <= 1}
                            className={`p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
                              distanceTiers.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="Remove Tier"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Tiers must be in ascending order by distance. The fee applies to orders within each tier's distance range.
                        Orders beyond the last tier will use the "Beyond Tier" fee settings from Delivery Logic.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          <div className="flex gap-4 pt-6 mt-6 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving || (distanceMode === 'custom' && distanceTiers.length === 0)}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save size={20} />
              {saving ? 'Saving...' : distanceMode === 'auto' ? 'Save Settings' : 'Save Distance Tiers'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

