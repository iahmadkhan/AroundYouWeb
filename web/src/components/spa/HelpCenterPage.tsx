import React, { useState } from 'react';
import { 
  HelpCircle, 
  Store, 
  Boxes, 
  ShoppingBag, 
  Truck, 
  BarChart3,
  Settings,
  CreditCard,
  Users,
  MapPin,
  FileText,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  MessageCircle
} from 'lucide-react';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  icon: React.ReactNode;
}

export default function HelpCenterPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const faqs: FAQItem[] = [
    // Shop Management
    {
      id: 'shop-1',
      category: 'shop',
      question: 'How do I create a new shop?',
      answer: 'Go to the "Shops" section in the sidebar and click "Create New Shop". Fill in the shop details including name, description, address, and upload a shop image. You can select the location using the map interface.',
      icon: <Store size={20} />
    },
    {
      id: 'shop-2',
      category: 'shop',
      question: 'How do I edit my shop information?',
      answer: 'Navigate to the "Shops" section, find your shop in the list, and click the "Edit" button. You can update any shop details including name, description, address, and image. Changes are saved immediately.',
      icon: <Store size={20} />
    },
    {
      id: 'shop-3',
      category: 'shop',
      question: 'Can I have multiple shops?',
      answer: 'Yes! You can create and manage multiple shops from your merchant dashboard. Each shop can have its own inventory, orders, and delivery settings.',
      icon: <Store size={20} />
    },
    {
      id: 'shop-4',
      category: 'shop',
      question: 'How do I delete a shop?',
      answer: 'Go to the "Shops" section, find the shop you want to delete, and click the "Delete" button. You\'ll be asked to confirm before the shop is permanently deleted. Note: This action cannot be undone.',
      icon: <Store size={20} />
    },

    // Inventory Management
    {
      id: 'inventory-1',
      category: 'inventory',
      question: 'How do I add items to my inventory?',
      answer: 'Go to "Inventory" > "All Items" and click "Add Item". Fill in the item details including name, description, price, SKU, barcode (optional), category, and upload an image. Click "Save" to add the item.',
      icon: <Boxes size={20} />
    },
    {
      id: 'inventory-2',
      category: 'inventory',
      question: 'How do I edit or delete an item?',
      answer: 'In the "All Items" view, find the item you want to modify. Click the "Edit" icon to update item details, or click the "Delete" icon to remove it. You\'ll be asked to confirm before deleting.',
      icon: <Boxes size={20} />
    },
    {
      id: 'inventory-3',
      category: 'inventory',
      question: 'How do I manage categories?',
      answer: 'Go to "Inventory" > "Categories" to view all your categories. You can add custom categories or add categories from templates. Click "Edit" to modify a category or "Delete" to remove it (only if no items are using it).',
      icon: <Boxes size={20} />
    },
    {
      id: 'inventory-4',
      category: 'inventory',
      question: 'What is the Audit Log?',
      answer: 'The Audit Log tracks all changes to your inventory including price changes, SKU edits, status updates, and template syncs. This provides full transparency of all inventory modifications.',
      icon: <FileText size={20} />
    },
    {
      id: 'inventory-5',
      category: 'inventory',
      question: 'How do I search for items?',
      answer: 'Use the search bar in "All Items" to search by product name, SKU, or barcode. The search is real-time and filters results as you type.',
      icon: <Boxes size={20} />
    },

    // Orders Management
    {
      id: 'orders-1',
      category: 'orders',
      question: 'How do I view my orders?',
      answer: 'Go to the "Orders" section in the sidebar. You\'ll see all orders for the selected shop, including order status, customer details, items, and total amount.',
      icon: <ShoppingBag size={20} />
    },
    {
      id: 'orders-2',
      category: 'orders',
      question: 'How do I update order status?',
      answer: 'In the Orders section, find the order you want to update and click on it. You can change the order status (e.g., pending, confirmed, preparing, ready, out for delivery, delivered).',
      icon: <ShoppingBag size={20} />
    },
    {
      id: 'orders-3',
      category: 'orders',
      question: 'Can I cancel an order?',
      answer: 'Yes, you can cancel orders from the Orders section. Select the order and choose "Cancel Order". The customer will be notified of the cancellation.',
      icon: <ShoppingBag size={20} />
    },

    // Delivery Management
    {
      id: 'delivery-1',
      category: 'delivery',
      question: 'How do I set up delivery areas?',
      answer: 'Go to "Delivery" > "Delivery Areas", select your shop, and click "Draw New Area". Click on the map to create a polygon for your delivery zone. Add at least 3 points, then click "Finish" and enter a label for the area.',
      icon: <MapPin size={20} />
    },
    {
      id: 'delivery-2',
      category: 'delivery',
      question: 'Can delivery areas overlap?',
      answer: 'No, delivery areas cannot overlap. If you try to save overlapping areas, you\'ll receive an error message. Please ensure each delivery zone has distinct boundaries.',
      icon: <MapPin size={20} />
    },
    {
      id: 'delivery-3',
      category: 'delivery',
      question: 'How do I manage delivery runners?',
      answer: 'Go to "Delivery" > "Delivery Runners" to add, edit, or remove delivery runners. You can assign runners to specific orders and track their availability.',
      icon: <Users size={20} />
    },
    {
      id: 'delivery-4',
      category: 'delivery',
      question: 'How do I configure delivery fees?',
      answer: 'Navigate to "Delivery" > "Delivery Logic" to set minimum order value, small order surcharge, distance-based fees, and free delivery thresholds. You can also set up distance tiering in "Distance Tiering".',
      icon: <Truck size={20} />
    },
    {
      id: 'delivery-5',
      category: 'delivery',
      question: 'What is distance tiering?',
      answer: 'Distance tiering allows you to set different delivery fees based on distance ranges. For example, you can charge Rs. 50 for 0-5km, Rs. 100 for 5-10km, etc. Configure this in "Delivery" > "Distance Tiering".',
      icon: <Truck size={20} />
    },

    // Analytics
    {
      id: 'analytics-1',
      category: 'analytics',
      question: 'What analytics are available?',
      answer: 'The Analytics section shows your shop\'s performance including total revenue, total orders, average order value, and revenue trends over time. You can view analytics for individual shops or across all shops.',
      icon: <BarChart3 size={20} />
    },
    {
      id: 'analytics-2',
      category: 'analytics',
      question: 'How often is analytics data updated?',
      answer: 'Analytics data is updated in real-time. When you view the Analytics section, you\'ll see the most current data based on your orders and sales.',
      icon: <BarChart3 size={20} />
    },

    // Account & Settings
    {
      id: 'account-1',
      category: 'account',
      question: 'How do I update my merchant account information?',
      answer: 'Go to your Profile settings to update your merchant account details. You can change your business information, contact details, and other account settings.',
      icon: <Settings size={20} />
    },
    {
      id: 'account-2',
      category: 'account',
      question: 'How do I switch between merchant and consumer views?',
      answer: 'Click "Switch to Consumer" in the Settings menu to return to the consumer side of the platform. You can switch back anytime from your profile menu.',
      icon: <Settings size={20} />
    },
    {
      id: 'account-3',
      category: 'account',
      question: 'How do I change my password?',
      answer: 'Go to your Profile settings and select "Change Password". Enter your current password and new password to update it.',
      icon: <Settings size={20} />
    },

    // Payments & Billing
    {
      id: 'payment-1',
      category: 'payment',
      question: 'How do I receive payments?',
      answer: 'Payments are processed automatically when customers place orders. You can view payment details in the Orders section. Payment methods and payout schedules can be configured in your account settings.',
      icon: <CreditCard size={20} />
    },
    {
      id: 'payment-2',
      category: 'payment',
      question: 'When do I get paid?',
      answer: 'Payment schedules vary based on your agreement. Typically, payments are processed weekly or bi-weekly. Check your account settings or contact support for specific payout information.',
      icon: <CreditCard size={20} />
    },
  ];

  const categories = [
    { id: 'all', label: 'All Categories', icon: <HelpCircle size={18} /> },
    { id: 'shop', label: 'Shop Management', icon: <Store size={18} /> },
    { id: 'inventory', label: 'Inventory', icon: <Boxes size={18} /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag size={18} /> },
    { id: 'delivery', label: 'Delivery', icon: <Truck size={18} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { id: 'account', label: 'Account & Settings', icon: <Settings size={18} /> },
    { id: 'payment', label: 'Payments & Billing', icon: <CreditCard size={18} /> },
  ];

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFAQ = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Help Center</h1>
        <p className="text-gray-600 text-lg">Find answers to common questions and get support for your merchant account</p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-12 pr-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <HelpCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        </div>
      </div>

      {/* Category Filters */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.icon}
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div className="space-y-3">
        {filteredFAQs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <HelpCircle className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">Try adjusting your search or category filter</p>
          </div>
        ) : (
          filteredFAQs.map((faq) => (
            <div
              key={faq.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md"
            >
              <button
                onClick={() => toggleFAQ(faq.id)}
                className="w-full px-6 py-4 flex items-start justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mt-1">
                    {faq.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{faq.question}</h3>
                    {expandedId === faq.id && (
                      <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                  {expandedId === faq.id ? (
                    <ChevronUp className="text-gray-400" size={20} />
                  ) : (
                    <ChevronDown className="text-gray-400" size={20} />
                  )}
                </div>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Contact Support */}
      <div className="mt-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg p-8 text-white">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold mb-4">Still need help?</h2>
          <p className="text-blue-100 mb-6">
            Our support team is here to assist you. Reach out to us through any of the following channels:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="mailto:support@aroundyou.com"
              className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-lg p-4 transition-colors"
            >
              <Mail size={24} />
              <div>
                <div className="font-semibold">Email Support</div>
                <div className="text-sm text-blue-100">support@aroundyou.com</div>
              </div>
            </a>
            <a
              href="tel:+923001234567"
              className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-lg p-4 transition-colors"
            >
              <Phone size={24} />
              <div>
                <div className="font-semibold">Phone Support</div>
                <div className="text-sm text-blue-100">+92 300 1234567</div>
              </div>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-lg p-4 transition-colors"
            >
              <MessageCircle size={24} />
              <div>
                <div className="font-semibold">Live Chat</div>
                <div className="text-sm text-blue-100">Available 24/7</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

