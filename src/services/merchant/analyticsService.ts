import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../supabase';

type ServiceResult<T> = { data: T | null; error: PostgrestError | null };

export type DailyRevenue = {
  date: string;
  revenue: number;
  order_count: number;
};

export type MonthlyRevenue = {
  month: string;
  revenue: number;
  order_count: number;
};

export type OrderStatusCount = {
  status: string;
  count: number;
};

export type AnalyticsData = {
  totalRevenue: number;
  totalOrders: number;
  todayRevenue: number;
  todayOrders: number;
  thisMonthRevenue: number;
  thisMonthOrders: number;
  lastMonthRevenue: number;
  lastMonthOrders: number;
  dailyRevenue: DailyRevenue[];
  monthlyRevenue: MonthlyRevenue[];
  statusBreakdown: OrderStatusCount[];
  averageOrderValue: number;
};

export async function getShopAnalytics(shopId: string): Promise<ServiceResult<AnalyticsData>> {
  try {
    const shopIds = [shopId];

    // Get all orders for these shops
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_cents, status, created_at')
      .in('shop_id', shopIds)
      .order('created_at', { ascending: false });

    // If orders table doesn't exist or there's an error, return empty data
    if (ordersError) {
      console.warn('Orders table not available or error fetching orders:', ordersError);
      return {
        data: {
          totalRevenue: 0,
          totalOrders: 0,
          todayRevenue: 0,
          todayOrders: 0,
          thisMonthRevenue: 0,
          thisMonthOrders: 0,
          lastMonthRevenue: 0,
          lastMonthOrders: 0,
          dailyRevenue: [],
          monthlyRevenue: [],
          statusBreakdown: [],
          averageOrderValue: 0,
        },
        error: null,
      };
    }

    if (!orders || orders.length === 0) {
      return {
        data: {
          totalRevenue: 0,
          totalOrders: 0,
          todayRevenue: 0,
          todayOrders: 0,
          thisMonthRevenue: 0,
          thisMonthOrders: 0,
          lastMonthRevenue: 0,
          lastMonthOrders: 0,
          dailyRevenue: [],
          monthlyRevenue: [],
          statusBreakdown: [],
          averageOrderValue: 0,
        },
        error: null,
      };
    }

    // Type assertion for orders array
    type OrderRow = { id: string; total_cents: number | null; status: string; created_at: string };
    const typedOrders = (orders || []) as OrderRow[];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Calculate totals
    const totalRevenue = typedOrders.reduce((sum, order) => sum + (order.total_cents || 0), 0) / 100;
    const totalOrders = typedOrders.length;

    // Today's stats
    const todayOrders = typedOrders.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate >= today;
    });
    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total_cents || 0), 0) / 100;

    // This month's stats
    const thisMonthOrders = typedOrders.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate >= thisMonthStart;
    });
    const thisMonthRevenue = thisMonthOrders.reduce((sum, order) => sum + (order.total_cents || 0), 0) / 100;

    // Last month's stats
    const lastMonthOrders = typedOrders.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
    });
    const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => sum + (order.total_cents || 0), 0) / 100;

    // Daily revenue (last 30 days)
    const dailyRevenueMap = new Map<string, { revenue: number; count: number }>();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    typedOrders
      .filter((order) => {
        const orderDate = new Date(order.created_at);
        return orderDate >= thirtyDaysAgo;
      })
      .forEach((order) => {
        const dateKey = new Date(order.created_at).toISOString().split('T')[0];
        const existing = dailyRevenueMap.get(dateKey) || { revenue: 0, count: 0 };
        dailyRevenueMap.set(dateKey, {
          revenue: existing.revenue + ((order.total_cents || 0) / 100),
          count: existing.count + 1,
        });
      });

    const dailyRevenue: DailyRevenue[] = Array.from(dailyRevenueMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        order_count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Monthly revenue (last 12 months)
    const monthlyRevenueMap = new Map<string, { revenue: number; count: number }>();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    typedOrders
      .filter((order) => {
        const orderDate = new Date(order.created_at);
        return orderDate >= twelveMonthsAgo;
      })
      .forEach((order) => {
        const orderDate = new Date(order.created_at);
        const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        const existing = monthlyRevenueMap.get(monthKey) || { revenue: 0, count: 0 };
        monthlyRevenueMap.set(monthKey, {
          revenue: existing.revenue + ((order.total_cents || 0) / 100),
          count: existing.count + 1,
        });
      });

    const monthlyRevenue: MonthlyRevenue[] = Array.from(monthlyRevenueMap.entries())
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        order_count: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Status breakdown
    const statusMap = new Map<string, number>();
    typedOrders.forEach((order) => {
      const status = order.status || 'unknown';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    const statusBreakdown: OrderStatusCount[] = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    // Average order value
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      data: {
        totalRevenue,
        totalOrders,
        todayRevenue,
        todayOrders: todayOrders.length,
        thisMonthRevenue,
        thisMonthOrders: thisMonthOrders.length,
        lastMonthRevenue,
        lastMonthOrders: lastMonthOrders.length,
        dailyRevenue,
        monthlyRevenue,
        statusBreakdown,
        averageOrderValue,
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Error calculating analytics', error);
    return { data: null, error: error as PostgrestError };
  }
}

export async function getMerchantAnalytics(merchantId: string): Promise<ServiceResult<AnalyticsData>> {
  try {
    // Get all shop IDs for this merchant
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('id')
      .eq('merchant_id', merchantId);

    if (shopsError || !shops || shops.length === 0) {
      return {
        data: {
          totalRevenue: 0,
          totalOrders: 0,
          todayRevenue: 0,
          todayOrders: 0,
          thisMonthRevenue: 0,
          thisMonthOrders: 0,
          lastMonthRevenue: 0,
          lastMonthOrders: 0,
          dailyRevenue: [],
          monthlyRevenue: [],
          statusBreakdown: [],
          averageOrderValue: 0,
        },
        error: null,
      };
    }

    type ShopRow = { id: string };
    const typedShops = (shops || []) as ShopRow[];
    const shopIds = typedShops.map((s) => s.id);

    // Get all orders for these shops
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_cents, status, created_at')
      .in('shop_id', shopIds)
      .order('created_at', { ascending: false });

    // If orders table doesn't exist or there's an error, return empty data
    if (ordersError) {
      console.warn('Orders table not available or error fetching orders:', ordersError);
      return {
        data: {
          totalRevenue: 0,
          totalOrders: 0,
          todayRevenue: 0,
          todayOrders: 0,
          thisMonthRevenue: 0,
          thisMonthOrders: 0,
          lastMonthRevenue: 0,
          lastMonthOrders: 0,
          dailyRevenue: [],
          monthlyRevenue: [],
          statusBreakdown: [],
          averageOrderValue: 0,
        },
        error: null,
      };
    }

    if (!orders || orders.length === 0) {
      return {
        data: {
          totalRevenue: 0,
          totalOrders: 0,
          todayRevenue: 0,
          todayOrders: 0,
          thisMonthRevenue: 0,
          thisMonthOrders: 0,
          lastMonthRevenue: 0,
          lastMonthOrders: 0,
          dailyRevenue: [],
          monthlyRevenue: [],
          statusBreakdown: [],
          averageOrderValue: 0,
        },
        error: null,
      };
    }

    // Type assertion for orders array
    type OrderRow = { id: string; total_cents: number | null; status: string; created_at: string };
    const typedOrders = (orders || []) as OrderRow[];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Calculate totals (convert cents to rupees)
    const totalRevenue = typedOrders.reduce((sum, order) => sum + (order.total_cents || 0), 0) / 100;
    const totalOrders = typedOrders.length;

    // Today's stats
    const todayOrders = typedOrders.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate >= today;
    });
    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total_cents || 0), 0) / 100;

    // This month's stats
    const thisMonthOrders = typedOrders.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate >= thisMonthStart;
    });
    const thisMonthRevenue = thisMonthOrders.reduce((sum, order) => sum + (order.total_cents || 0), 0) / 100;

    // Last month's stats
    const lastMonthOrders = typedOrders.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
    });
    const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => sum + (order.total_cents || 0), 0) / 100;

    // Daily revenue (last 30 days)
    const dailyRevenueMap = new Map<string, { revenue: number; count: number }>();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    typedOrders
      .filter((order) => {
        const orderDate = new Date(order.created_at);
        return orderDate >= thirtyDaysAgo;
      })
      .forEach((order) => {
        const dateKey = new Date(order.created_at).toISOString().split('T')[0];
        const existing = dailyRevenueMap.get(dateKey) || { revenue: 0, count: 0 };
        dailyRevenueMap.set(dateKey, {
          revenue: existing.revenue + ((order.total_cents || 0) / 100),
          count: existing.count + 1,
        });
      });

    const dailyRevenue: DailyRevenue[] = Array.from(dailyRevenueMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        order_count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Monthly revenue (last 12 months)
    const monthlyRevenueMap = new Map<string, { revenue: number; count: number }>();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    typedOrders
      .filter((order) => {
        const orderDate = new Date(order.created_at);
        return orderDate >= twelveMonthsAgo;
      })
      .forEach((order) => {
        const orderDate = new Date(order.created_at);
        const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        const existing = monthlyRevenueMap.get(monthKey) || { revenue: 0, count: 0 };
        monthlyRevenueMap.set(monthKey, {
          revenue: existing.revenue + ((order.total_cents || 0) / 100),
          count: existing.count + 1,
        });
      });

    const monthlyRevenue: MonthlyRevenue[] = Array.from(monthlyRevenueMap.entries())
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        order_count: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Status breakdown
    const statusMap = new Map<string, number>();
    typedOrders.forEach((order) => {
      const status = order.status || 'unknown';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    const statusBreakdown: OrderStatusCount[] = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    // Average order value
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      data: {
        totalRevenue,
        totalOrders,
        todayRevenue,
        todayOrders: todayOrders.length,
        thisMonthRevenue,
        thisMonthOrders: thisMonthOrders.length,
        lastMonthRevenue,
        lastMonthOrders: lastMonthOrders.length,
        dailyRevenue,
        monthlyRevenue,
        statusBreakdown,
        averageOrderValue,
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Error calculating analytics', error);
    return { data: null, error: error as PostgrestError };
  }
}

