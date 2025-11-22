import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../src/services/supabase';
import { getShopReviews, getShopReviewStats } from '../../../../src/services/consumer/reviewService';

interface DashboardSummaryProps {
  shopId?: string;
}

type TimePeriod = 'today' | 'yesterday' | '7days' | '30days' | 'alltime' | 'custom';

interface Order {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface ChartDataPoint {
  time: string;
  orders: number;
  value: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  customer_name: string;
  created_at: string;
}

export default function DashboardSummary({ shopId }: DashboardSummaryProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('today');
  const [orders, setOrders] = useState<Order[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState({ day: '', month: '', year: '' });
  const [customEndDate, setCustomEndDate] = useState({ day: '', month: '', year: '' });
  const [summary, setSummary] = useState({
    orders: 0,
    revenue: 0,
  });

  useEffect(() => {
    if (shopId) {
      loadData();
    }
  }, [shopId, timePeriod, customStartDate, customEndDate]);

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timePeriod) {
      case 'today':
        return { start: today, end: now };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);
        return { start: yesterday, end: yesterdayEnd };
      case '7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return { start: sevenDaysAgo, end: now };
      case '30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return { start: thirtyDaysAgo, end: now };
      case 'alltime':
        return { start: new Date(0), end: now };
      case 'custom':
        // Use custom date range if set
        if (customStartDate.day && customStartDate.month && customStartDate.year &&
            customEndDate.day && customEndDate.month && customEndDate.year) {
          const start = new Date(
            parseInt(customStartDate.year),
            parseInt(customStartDate.month) - 1,
            parseInt(customStartDate.day)
          );
          start.setHours(0, 0, 0, 0);
          const end = new Date(
            parseInt(customEndDate.year),
            parseInt(customEndDate.month) - 1,
            parseInt(customEndDate.day)
          );
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        return { start: new Date(0), end: now };
      default:
        return { start: today, end: now };
    }
  };


  const loadData = async () => {
    if (!shopId) return;
    
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
      // Load real orders from database
      // Use placed_at instead of created_at for filtering orders (orders table uses placed_at)
      let query = supabase
        .from('orders')
        .select('id, total_cents, status, created_at, placed_at')
        .eq('shop_id', shopId)
        .gte('placed_at', start.toISOString())
        .lte('placed_at', end.toISOString())
        .order('placed_at', { ascending: true });

      const { data: ordersData, error } = await query;

      if (error) {
        console.error('Error loading orders:', error);
        setOrders([]);
        setSummary({ orders: 0, revenue: 0 });
        setChartData([]);
        setReviews([]);
        setAverageRating(0);
        return;
      }

      // Convert orders to format expected by component
      const finalOrdersData: Order[] = (ordersData || []).map((order: any) => ({
        id: order.id,
        total_amount: (order.total_cents || 0) / 100, // Convert cents to rupees
        status: order.status,
        created_at: order.placed_at || order.created_at,
      }));

      setOrders(finalOrdersData);
      
      // Calculate summary from real orders
      const totalOrders = finalOrdersData.length;
      const totalRevenue = finalOrdersData
        .filter(o => o.status === 'completed' || o.status === 'delivered')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);
      
      setSummary({
        orders: totalOrders,
        revenue: totalRevenue,
      });

      // Generate chart data based on time period from real orders
      generateChartData(finalOrdersData, start, end);
      
      // Load reviews and average using shared review service for consistency
      const [reviewsResp, statsResp] = await Promise.all([
        getShopReviews(shopId),
        getShopReviewStats(shopId),
      ]);

      const reviewsData = (reviewsResp.data || []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.review_text || '',
        customer_name: r.user?.name || r.user?.email || 'Customer',
        created_at: r.created_at,
      })) as Review[];

      setReviews(reviewsData);
      setAverageRating(statsResp.data?.average_rating || 0);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // On error, show empty state
      setOrders([]);
      setSummary({ orders: 0, revenue: 0 });
      setChartData([]);
      setReviews([]);
      setAverageRating(0);
    } finally {
      setLoading(false);
    }
  };


  const generateChartData = (ordersData: Order[], start: Date, end: Date) => {
    const dataPoints: ChartDataPoint[] = [];
    const hoursDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    let cumulativeRevenue = 0;
    
    if (timePeriod === 'today' || timePeriod === 'yesterday') {
      // Hourly data for today/yesterday - cumulative
      const hours = Math.ceil(hoursDiff);
      for (let i = 0; i <= hours; i++) {
        const hourStart = new Date(start);
        hourStart.setHours(start.getHours() + i, 0, 0, 0);
        const hourEnd = new Date(hourStart);
        hourEnd.setHours(hourEnd.getHours() + 1);
        
        const hourOrders = ordersData.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= hourStart && orderDate < hourEnd;
        });
        
        const ordersCount = hourOrders.length;
        const periodRevenue = hourOrders
          .filter(o => o.status === 'completed' || o.status === 'delivered')
          .reduce((sum, o) => sum + (o.total_amount || 0), 0);
        
        cumulativeRevenue += periodRevenue;
        
        dataPoints.push({
          time: hourStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          orders: ordersCount,
          value: cumulativeRevenue,
        });
      }
    } else if (timePeriod === '7days') {
      // Daily data for 7 days - cumulative
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(start);
        dayStart.setDate(dayStart.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayOrders = ordersData.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= dayStart && orderDate <= dayEnd;
        });
        
        const ordersCount = dayOrders.length;
        const periodRevenue = dayOrders
          .filter(o => o.status === 'completed' || o.status === 'delivered')
          .reduce((sum, o) => sum + (o.total_amount || 0), 0);
        
        cumulativeRevenue += periodRevenue;
        
        dataPoints.push({
          time: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          orders: ordersCount,
          value: cumulativeRevenue,
        });
      }
    } else if (timePeriod === '30days') {
      // Daily data for 30 days - cumulative
      for (let i = 0; i < 30; i++) {
        const dayStart = new Date(start);
        dayStart.setDate(dayStart.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayOrders = ordersData.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= dayStart && orderDate <= dayEnd;
        });
        
        const ordersCount = dayOrders.length;
        const periodRevenue = dayOrders
          .filter(o => o.status === 'completed' || o.status === 'delivered')
          .reduce((sum, o) => sum + (o.total_amount || 0), 0);
        
        cumulativeRevenue += periodRevenue;
        
        dataPoints.push({
          time: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          orders: ordersCount,
          value: cumulativeRevenue,
        });
      }
    } else {
      // Monthly data for all time - cumulative
      const months = Math.ceil(hoursDiff / (24 * 30));
      for (let i = 0; i < Math.min(months, 12); i++) {
        const monthStart = new Date(start);
        monthStart.setMonth(monthStart.getMonth() + i, 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        
        const monthOrders = ordersData.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= monthStart && orderDate < monthEnd;
        });
        
        const ordersCount = monthOrders.length;
        const periodRevenue = monthOrders
          .filter(o => o.status === 'completed' || o.status === 'delivered')
          .reduce((sum, o) => sum + (o.total_amount || 0), 0);
        
        cumulativeRevenue += periodRevenue;
        
        dataPoints.push({
          time: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          orders: ordersCount,
          value: cumulativeRevenue,
        });
      }
    }
    
    setChartData(dataPoints);
  };

  const maxOrders = Math.max(...chartData.map(d => d.orders), 1);
  const maxValue = Math.max(...chartData.map(d => d.value), 100);
  const chartHeight = 250;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Summary</h1>
      
      {/* Time Period Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['today', 'yesterday', '7days', '30days', 'alltime', 'custom'] as TimePeriod[]).map((period) => (
          <button
            key={period}
            onClick={() => {
              if (period === 'custom') {
                setShowCustomDateModal(true);
              } else {
                setTimePeriod(period);
              }
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timePeriod === period
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            {period === '7days' ? '7 days' : period === '30days' ? '30 days' : period === 'alltime' ? 'All time' : period.charAt(0).toUpperCase() + period.slice(1)}
          </button>
        ))}
      </div>

      {/* Custom Date Range Modal */}
      {showCustomDateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Select Date Range</h2>
              <button
                onClick={() => setShowCustomDateModal(false)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Start Date</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="DD"
                    value={customStartDate.day}
                    onChange={(e) => setCustomStartDate({ ...customStartDate, day: e.target.value })}
                    maxLength={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                  />
                  <input
                    type="text"
                    placeholder="MM"
                    value={customStartDate.month}
                    onChange={(e) => setCustomStartDate({ ...customStartDate, month: e.target.value })}
                    maxLength={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                  />
                  <input
                    type="text"
                    placeholder="YYYY"
                    value={customStartDate.year}
                    onChange={(e) => setCustomStartDate({ ...customStartDate, year: e.target.value })}
                    maxLength={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                  />
                </div>
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">End Date</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="DD"
                    value={customEndDate.day}
                    onChange={(e) => setCustomEndDate({ ...customEndDate, day: e.target.value })}
                    maxLength={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                  />
                  <input
                    type="text"
                    placeholder="MM"
                    value={customEndDate.month}
                    onChange={(e) => setCustomEndDate({ ...customEndDate, month: e.target.value })}
                    maxLength={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                  />
                  <input
                    type="text"
                    placeholder="YYYY"
                    value={customEndDate.year}
                    onChange={(e) => setCustomEndDate({ ...customEndDate, year: e.target.value })}
                    maxLength={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  if (customStartDate.day && customStartDate.month && customStartDate.year &&
                      customEndDate.day && customEndDate.month && customEndDate.year) {
                    setTimePeriod('custom');
                    setShowCustomDateModal(false);
                  }
                }}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-gray-500 text-sm mb-1">Orders</p>
                <p className="text-3xl font-bold text-gray-900">{summary.orders}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Revenue</p>
                <p className="text-3xl font-bold text-gray-900">Rs {summary.revenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (() => {
            // Ensure maxValue is at least 1 to avoid division issues
            const safeMaxValue = Math.max(maxValue, 1);
            const chartAreaHeight = chartHeight - 30;
            const chartAreaTop = 0;
            const chartAreaBottom = chartHeight - 30;
            
            // Calculate Y position: 0 value = bottom, maxValue = top
            const getYPosition = (value: number) => {
              const ratio = safeMaxValue > 0 ? value / safeMaxValue : 0;
              return chartAreaBottom - (ratio * chartAreaHeight);
            };
            
            return (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Revenue</h2>
                  <p className="text-sm text-gray-500 mt-1">IN THOUSANDS (PKR)</p>
                </div>
                <div className="relative" style={{ height: `${chartHeight}px` }}>
                  <svg width="100%" height={chartHeight} viewBox={`0 0 800 ${chartHeight}`} preserveAspectRatio="none" className="overflow-visible">
                    {/* Y-axis line */}
                    <line x1="60" y1={chartAreaTop} x2="60" y2={chartAreaBottom} stroke="#d1d5db" strokeWidth="1.5" />
                    
                    {/* Gradient definition for area fill */}
                    <defs>
                      <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    
                    {/* Y-axis labels and grid lines */}
                    {(() => {
                      // Reduce number of steps to prevent overlapping
                      const numSteps = 6;
                      const stepValue = Math.max(1, Math.ceil(safeMaxValue / numSteps / 100) * 100);
                      const actualMax = stepValue * numSteps;
                      const minSpacing = 30; // Minimum spacing between labels in pixels
                      const labels: { value: number; y: number }[] = [];
                      
                      // Collect all potential labels
                      for (let i = 0; i <= numSteps; i++) {
                        const value = stepValue * i;
                        const y = getYPosition(value);
                        labels.push({ value, y });
                      }
                      
                      // Filter out labels that are too close together
                      const filteredLabels: { value: number; y: number }[] = [];
                      let lastY = -Infinity;
                      
                      for (const label of labels) {
                        if (Math.abs(label.y - lastY) >= minSpacing || filteredLabels.length === 0) {
                          filteredLabels.push(label);
                          lastY = label.y;
                        }
                      }
                      
                      return filteredLabels.map((label, idx) => (
                        <g key={idx}>
                          <line x1="60" y1={label.y} x2="750" y2={label.y} stroke="#e5e7eb" strokeWidth="1" />
                          <text x="55" y={label.y + 4} fontSize="11" fill="#6b7280" textAnchor="end">
                            {Math.round(label.value)}
                          </text>
                        </g>
                      ));
                    })()}
                    
                    {/* Area fill below the line */}
                    <path
                      d={(() => {
                        const points = chartData.map((point, index) => {
                          const x = 60 + (index / (chartData.length - 1 || 1)) * 690;
                          const y = getYPosition(point.value);
                          // Ensure y doesn't go below x-axis
                          return { x, y: Math.max(chartAreaTop, Math.min(chartAreaBottom, y)) };
                        });
                        
                        if (points.length === 0) return '';
                        if (points.length === 1) {
                          return `M ${points[0].x} ${chartAreaBottom} L ${points[0].x} ${points[0].y} L ${points[0].x} ${chartAreaBottom} Z`;
                        }
                        
                        // Use Catmull-Rom spline for smooth curves
                        let path = `M ${points[0].x} ${chartAreaBottom} L ${points[0].x} ${points[0].y}`;
                        
                        for (let i = 0; i < points.length - 1; i++) {
                          const p0 = points[Math.max(0, i - 1)];
                          const p1 = points[i];
                          const p2 = points[i + 1];
                          const p3 = points[Math.min(points.length - 1, i + 2)];
                          
                          // Calculate control points for smooth curve
                          const cp1x = p1.x + (p2.x - p0.x) / 6;
                          const cp1y = p1.y + (p2.y - p0.y) / 6;
                          const cp2x = p2.x - (p3.x - p1.x) / 6;
                          const cp2y = p2.y - (p3.y - p1.y) / 6;
                          
                          // Clamp control points to stay within chart area
                          const clampedCp1y = Math.max(chartAreaTop, Math.min(chartAreaBottom, cp1y));
                          const clampedCp2y = Math.max(chartAreaTop, Math.min(chartAreaBottom, cp2y));
                          
                          path += ` C ${cp1x} ${clampedCp1y}, ${cp2x} ${clampedCp2y}, ${p2.x} ${p2.y}`;
                        }
                        
                        // Close the path by going to the last point's x at bottom, then back to start
                        const lastPoint = points[points.length - 1];
                        path += ` L ${lastPoint.x} ${chartAreaBottom} Z`;
                        
                        return path;
                      })()}
                      fill="url(#areaGradient)"
                      stroke="none"
                    />
                    
                    {/* Revenue line with smooth curves */}
                    <path
                      d={(() => {
                        const points = chartData.map((point, index) => {
                          const x = 60 + (index / (chartData.length - 1 || 1)) * 690;
                          const y = getYPosition(point.value);
                          // Ensure y doesn't go below x-axis
                          return { x, y: Math.max(chartAreaTop, Math.min(chartAreaBottom, y)) };
                        });
                        
                        if (points.length === 0) return '';
                        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
                        
                        // Use Catmull-Rom spline for smooth curves
                        let path = `M ${points[0].x} ${points[0].y}`;
                        
                        for (let i = 0; i < points.length - 1; i++) {
                          const p0 = points[Math.max(0, i - 1)];
                          const p1 = points[i];
                          const p2 = points[i + 1];
                          const p3 = points[Math.min(points.length - 1, i + 2)];
                          
                          // Calculate control points for smooth curve
                          const cp1x = p1.x + (p2.x - p0.x) / 6;
                          const cp1y = p1.y + (p2.y - p0.y) / 6;
                          const cp2x = p2.x - (p3.x - p1.x) / 6;
                          const cp2y = p2.y - (p3.y - p1.y) / 6;
                          
                          // Clamp control points to stay within chart area
                          const clampedCp1y = Math.max(chartAreaTop, Math.min(chartAreaBottom, cp1y));
                          const clampedCp2y = Math.max(chartAreaTop, Math.min(chartAreaBottom, cp2y));
                          
                          path += ` C ${cp1x} ${clampedCp1y}, ${cp2x} ${clampedCp2y}, ${p2.x} ${p2.y}`;
                        }
                        
                        return path;
                      })()}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                    />
                    
                    {/* X-axis line */}
                    <line x1="60" y1={chartAreaBottom} x2="750" y2={chartAreaBottom} stroke="#d1d5db" strokeWidth="1.5" />
                  
                  {/* X-axis labels (Time) - Show fewer labels to prevent overlapping */}
                  {(() => {
                    // Determine how many labels to show based on data points
                    let labelInterval = 1;
                    const minXSpacing = 60; // Minimum spacing between X-axis labels in pixels
                    
                    if (chartData.length > 24) {
                      labelInterval = Math.ceil(chartData.length / 10); // Show ~10 labels max
                    } else if (chartData.length > 12) {
                      labelInterval = Math.ceil(chartData.length / 8); // Show ~8 labels max
                    } else if (chartData.length > 7) {
                      labelInterval = 2; // Show every other label
                    }
                    
                    // Get all potential labels
                    const potentialLabels = chartData
                      .map((point, index) => ({ point, index }))
                      .filter(({ index }) => index % labelInterval === 0 || index === chartData.length - 1);
                    
                    // Filter labels that are too close together
                    const filteredLabels: { point: ChartDataPoint; index: number; x: number }[] = [];
                    let lastX = -Infinity;
                    
                    for (const { point, index } of potentialLabels) {
                      const x = 60 + (index / (chartData.length - 1 || 1)) * 690;
                      if (Math.abs(x - lastX) >= minXSpacing || filteredLabels.length === 0) {
                        filteredLabels.push({ point, index, x });
                        lastX = x;
                      }
                    }
                    
                    return filteredLabels.map(({ point, index, x }) => (
                      <text
                        key={index}
                        x={x}
                        y={chartHeight - 10}
                        fontSize="11"
                        fill="#6b7280"
                        textAnchor="middle"
                      >
                        {point.time}
                      </text>
                    ));
                  })()}
                  </svg>
                </div>
              </div>
            );
          })()}

          {/* Reviews Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Reviews</h2>
              {reviews.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Average Rating:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold text-gray-900">{averageRating.toFixed(1)}</span>
                    <span className="text-yellow-500 text-xl">★</span>
                  </div>
                </div>
              )}
            </div>
            {reviews.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No reviews available</p>
                <p className="text-sm text-gray-400">Reviews will appear here when customers leave feedback</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{review.customer_name}</p>
                        <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`text-lg ${star <= review.rating ? 'text-yellow-500' : 'text-gray-300'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

