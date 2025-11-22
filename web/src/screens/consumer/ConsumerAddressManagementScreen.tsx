import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { useAuth } from '../../../../src/context/AuthContext';
import * as addressService from '../../../../src/services/consumer/addressService';
import EditIcon from '../../../../src/icons/EditIcon';
import DeleteIcon from '../../../../src/icons/DeleteIcon';
import AddressMapModal from '../../components/consumer/AddressMapModal';
import { useLocationSelection } from '../../../../src/context/LocationContext';

export default function ConsumerAddressManagementScreen() {
  const [showMapModal, setShowMapModal] = React.useState(false);
  const [editingAddress, setEditingAddress] = React.useState<addressService.ConsumerAddress | null>(null);
  const [addressToDelete, setAddressToDelete] = React.useState<addressService.ConsumerAddress | null>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { setSelectedAddress } = useLocationSelection();
  const queryClient = useQueryClient();

  // When true, this screen is being used to pick an address (e.g. from order status)
  const routeState = (location.state || {}) as { selectMode?: boolean; from?: string; orderId?: string };
  const selectMode = Boolean(routeState.selectMode);
  const fromOrderStatus = routeState.from === 'order-status';
  const orderIdFromState = routeState.orderId;

  // If user is not signed in (and auth has finished loading), redirect back to home/shop browsing.
  React.useEffect(() => {
    if (!loading && !user) {
      navigate('/home', { replace: true });
    }
  }, [loading, user, navigate]);

  // Use React Query for fast, cached address loading
  const { data: addresses = [], isLoading: loadingAddresses, refetch: refetchAddresses } = useQuery({
    queryKey: ['user-addresses', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await addressService.getUserAddresses();
      if (error) {
        console.log('Error fetching addresses:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!user, // Only fetch when user is available
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Prefetch addresses immediately when user is available for faster loading
  React.useEffect(() => {
    if (user) {
      // Prefetch immediately to ensure data is available quickly when screen loads
      queryClient.prefetchQuery({
        queryKey: ['user-addresses', user.id],
        queryFn: async () => {
          const { data, error } = await addressService.getUserAddresses();
          if (error) throw error;
          return data || [];
        },
        staleTime: 30000,
        gcTime: 5 * 60 * 1000,
      });
    }
  }, [user, queryClient]);

  const handleSelectAddressForOrder = (address: addressService.ConsumerAddress) => {
    // Update global selected/confirmed location
    const coords = {
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    };
    setSelectedAddress({
      label: address.street_address,
      city: address.city,
      coords,
      isCurrent: false,
      addressId: address.id,
    });

    // Navigate back to order status screen if we know the orderId and origin
    if (fromOrderStatus && orderIdFromState) {
      navigate(`/orderstatus?orderId=${orderIdFromState}`);
    } else {
      // Fallback: just go back one step in history
      navigate(-1);
    }
  };

  const handleDeleteAddress = (address: addressService.ConsumerAddress) => {
    // Open friendly inline confirmation instead of native confirm()
    setAddressToDelete(address);
  };

  const confirmDeleteAddress = () => {
    if (!addressToDelete) return;

    addressService
      .deleteAddress(addressToDelete.id)
      .then((result) => {
        if (!result.error) {
          // Invalidate and refetch addresses
          queryClient.invalidateQueries({ queryKey: ['user-addresses', user?.id] });
          refetchAddresses();
        } else {
          console.error('Failed to delete address:', result.error);
          alert(result.error.message || 'Failed to delete address. It may be used in existing orders.');
        }
      })
      .catch((err: any) => {
        console.error('Failed to delete address:', err);
        alert(err?.message || 'Failed to delete address. It may be used in existing orders.');
      })
      .finally(() => {
        setAddressToDelete(null);
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-8 md:py-10 flex justify-center">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <span className="text-lg">←</span>
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Addresses</h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage your saved delivery locations for faster checkout.
              </p>
            </div>
          </div>
          {!selectMode && (
            <button
              onClick={() => {
                setEditingAddress(null);
                setShowMapModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all"
            >
              <span className="text-lg">＋</span>
              <span>Add address</span>
            </button>
          )}
        </div>

        {/* Content card */}
        <div className="bg-white/90 backdrop-blur rounded-3xl shadow-xl border border-slate-100">
          {loadingAddresses ? (
            <div className="p-6">
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 rounded-2xl" />
                ))}
              </div>
            </div>
          ) : addresses.length === 0 ? (
            <div className="px-6 py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl">
                📍
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">No addresses saved yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Save your home, work, and other places you order from frequently.
                </p>
              </div>
              {!selectMode && (
                <button
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all"
                  onClick={() => {
                    setEditingAddress(null);
                    setShowMapModal(true);
                  }}
                >
                  Add your first address
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 md:p-6 space-y-3">
          {addresses.map((address) =>
            selectMode ? (
              // Select-only mode: whole card is clickable, no edit/delete buttons
              <div
                key={address.id}
                className="w-full text-left bg-white rounded-xl p-4 shadow-sm hover:bg-blue-50 transition-colors cursor-pointer"
                onClick={() => handleSelectAddressForOrder(address)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {address.title && (
                      <div className="text-sm font-semibold text-blue-600 mb-1">{address.title}</div>
                    )}
                    <div className="text-base font-semibold text-gray-900">{address.street_address}</div>
                    <div className="text-sm text-gray-600">
                      {address.city}
                      {address.region ? `, ${address.region}` : ''}
                    </div>
                    {address.landmark && (
                      <div className="text-sm text-gray-500 mt-1">📍 {address.landmark}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Normal management mode: show edit/delete actions
              <div key={address.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {address.title && (
                      <div className="text-sm font-semibold text-blue-600 mb-1">{address.title}</div>
                    )}
                    <div className="text-base font-semibold text-gray-900">{address.street_address}</div>
                    <div className="text-sm text-gray-600">
                      {address.city}
                      {address.region ? `, ${address.region}` : ''}
                    </div>
                    {address.landmark && (
                      <div className="text-sm text-gray-500 mt-1">📍 {address.landmark}</div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setEditingAddress(address);
                        setShowMapModal(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <EditIcon size={20} color="#3B82F6" />
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(address)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <DeleteIcon size={20} color="#EF4444" />
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
            </div>
          )}
        </div>

        {/* Address Map Modal */}
        {!selectMode && (
          <AddressMapModal
            visible={showMapModal}
            onClose={() => setShowMapModal(false)}
            showSaveOption={true}
            initialAddress={editingAddress?.street_address}
            initialLatitude={editingAddress?.latitude}
            initialLongitude={editingAddress?.longitude}
            onSaveAddress={() => {
              // Invalidate and refetch addresses after saving
              queryClient.invalidateQueries({ queryKey: ['user-addresses', user?.id] });
              refetchAddresses();
            }}
          />
        )}

        {/* Friendly delete confirmation overlay */}
        {addressToDelete && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Delete address?</h2>
              <p className="text-sm text-slate-600 mb-3">
                This address may be linked to your previous orders. If so, the system might not allow deleting it.
              </p>
              <p className="text-sm text-slate-800 font-medium mb-4">
                {addressToDelete.street_address}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                  onClick={() => setAddressToDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700"
                  onClick={confirmDeleteAddress}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

