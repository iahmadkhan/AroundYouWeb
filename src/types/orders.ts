export type PaymentMethod = 'cash' | 'card' | 'wallet';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface DeliveryAddress {
  id: string;
  title?: string | null;
  street_address: string;
  city: string;
  region?: string | null;
  latitude: number;
  longitude: number;
  landmark?: string | null;
  formatted_address?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  merchant_item_id: string;
  item_name: string;
  item_description?: string | null;
  item_image_url?: string | null;
  item_price_cents: number;
  quantity: number;
  subtotal_cents: number;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number?: string | null;
  shop_id: string;
  user_id: string;
  consumer_address_id: string;
  delivery_runner_id?: string | null;
  status: OrderStatus;
  subtotal_cents: number;
  delivery_fee_cents: number;
  surcharge_cents: number;
  total_cents: number;
  payment_method: PaymentMethod;
  special_instructions?: string | null;
  placed_at: string;
  confirmed_at?: string | null;
  out_for_delivery_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  cancelled_by?: string | null;
  confirmation_time_seconds?: number | null;
  preparation_time_seconds?: number | null;
  delivery_time_seconds?: number | null;
  delivery_address?: DeliveryAddress | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface ShopSummary {
  id: string;
  name: string;
  image_url?: string | null;
  shop_type?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DeliveryRunnerSummary {
  id: string;
  name: string;
  phone_number?: string | null;
}

export interface OrderWithAll extends OrderWithItems {
  shop?: ShopSummary | null;
  delivery_runner?: DeliveryRunnerSummary | null;
}

export interface PlaceOrderRequest {
  shop_id: string;
  consumer_address_id: string;
  items: Array<{ merchant_item_id: string; quantity: number }>;
  payment_method: PaymentMethod;
  special_instructions?: string | null;
}

export interface PlaceOrderResponse {
  success: boolean;
  message?: string;
  order: OrderWithItems | null;
}

export interface OrderCalculation {
  subtotal_cents: number;
  delivery_fee_cents: number;
  surcharge_cents: number;
  total_cents: number;
  distance_meters: number;
}

export interface OrderFilters {
  statusFilter?: OrderStatus;
  timeFilter?: 'today' | 'yesterday' | '7days' | '30days' | 'custom' | 'all';
  customStartDate?: Date;
  customEndDate?: Date;
}

export interface DeliveryRunnerWithStatus {
  id: string;
  shop_id: string;
  name: string;
  phone_number?: string | null;
  is_available: boolean;
  current_order_id?: string;
  current_order_number?: string;
}

export interface OrderAnalytics {
  total_orders: number;
  total_revenue_cents: number;
  average_order_value_cents: number;
  average_confirmation_time_seconds?: number;
  average_preparation_time_seconds?: number;
  average_delivery_time_seconds?: number;
  status_breakdown: Record<OrderStatus, number>;
}

