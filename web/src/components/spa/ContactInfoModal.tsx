import React, { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, Globe, X, Edit2, Save, Check } from 'lucide-react';

interface ContactInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const defaultContactInfo = {
  phone: '+92 300 1234567',
  email: 'merchant@aroundyou.com',
  address: '123 Business Street, City, Country',
  website: 'www.aroundyou.com',
};

// Load saved contact info from localStorage or use defaults
const loadContactInfo = () => {
  try {
    const saved = localStorage.getItem('merchantContactInfo');
    return saved ? JSON.parse(saved) : defaultContactInfo;
  } catch {
    return defaultContactInfo;
  }
};

export default function ContactInfoModal({ isOpen, onClose }: ContactInfoModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [contactInfo, setContactInfo] = useState(loadContactInfo());
  const [editedInfo, setEditedInfo] = useState(contactInfo);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reload contact info when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadedInfo = loadContactInfo();
      setContactInfo(loadedInfo);
      setEditedInfo(loadedInfo);
      setIsEditing(false);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  const handleEdit = () => {
    setEditedInfo(contactInfo);
    setIsEditing(true);
  };

  const handleSave = () => {
    // Save to localStorage (in a real app, this would save to backend)
    localStorage.setItem('merchantContactInfo', JSON.stringify(editedInfo));
    setContactInfo(editedInfo);
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleCancel = () => {
    setEditedInfo(contactInfo);
    setIsEditing(false);
  };

  const handleChange = (field: string, value: string) => {
    setEditedInfo(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Phone className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-bold text-white">Contact Information</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/90 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {saveSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <Check className="text-green-600" size={18} />
              <p className="text-green-700 text-sm font-semibold">Contact information saved successfully!</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Phone */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Phone className="text-blue-600" size={20} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editedInfo.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter phone number"
                  />
                ) : (
                  <p className="text-gray-900 font-medium">{contactInfo.phone}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Mail className="text-green-600" size={20} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editedInfo.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email address"
                  />
                ) : (
                  <p className="text-gray-900 font-medium">{contactInfo.email}</p>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <MapPin className="text-purple-600" size={20} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Business Address</label>
                {isEditing ? (
                  <textarea
                    value={editedInfo.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Enter business address"
                    rows={3}
                  />
                ) : (
                  <p className="text-gray-900 font-medium">{contactInfo.address}</p>
                )}
              </div>
            </div>

            {/* Website */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Globe className="text-orange-600" size={20} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Website</label>
                {isEditing ? (
                  <input
                    type="url"
                    value={editedInfo.website}
                    onChange={(e) => handleChange('website', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter website URL"
                  />
                ) : (
                  <a 
                    href={`https://${contactInfo.website}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                  >
                    {contactInfo.website}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Save size={18} />
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Edit2 size={18} />
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

