import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../../../src/services/supabase';

interface AuditLogEntry {
  id: string;
  shop_id: string;
  merchant_item_id: string;
  action_type: string;
  changed_fields: Record<string, { from: unknown; to: unknown }>;
  source: string;
  actor: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
  };
  created_at: string;
  item_name?: string;
  item_price_cents?: number;
  item_currency?: string;
}

interface AuditLogPageProps {
  shopId?: string;
}

const actionLabels: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  ACTIVATE: 'Marked Active',
  DEACTIVATE: 'Marked Inactive',
  IMPORT: 'Imported',
  TEMPLATE_UPDATE: 'Synced from template',
};

function formatPrice(value: unknown, currency: string = 'PKR') {
  if (typeof value !== 'number') {
    return '—';
  }
  const amount = value / 100;
  if (currency === 'PKR') {
    return `Rs. ${amount.toFixed(0)}`;
  }
  return `${currency} ${amount.toFixed(2)}`;
}

function toSentence(label: string) {
  return label
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function formatDiffValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '—';
  }
  return String(value);
}

function buildChangeSummary(entry: AuditLogEntry): string[] {
  const changes = entry.changed_fields ?? {};
  const meaningfulChanges = Object.entries(changes).filter(([field]) => field !== 'noop');
  const summaries: string[] = [];

  meaningfulChanges.forEach(([field, diff]) => {
    if (!diff) {
      return;
    }
    const normalizedField = field.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
    if (normalizedField === 'priceCents' || normalizedField === 'price_cents') {
      const currency = entry.item_currency || 'PKR';
      summaries.push(`Price ${formatPrice(diff.from, currency)} → ${formatPrice(diff.to, currency)}`);
      return;
    }
    if (normalizedField === 'isActive' || normalizedField === 'is_active') {
      const next = diff.to === true ? 'active' : 'inactive';
      summaries.push(`Status marked ${next}`);
      return;
    }
    if (normalizedField === 'sku' || normalizedField === 'SKU') {
      summaries.push(`SKU ${formatDiffValue(diff.from)} → ${formatDiffValue(diff.to)}`);
      return;
    }
    if (normalizedField === 'templateId' || normalizedField === 'template_id') {
      summaries.push('Template synced');
      return;
    }
    const fromValue = formatDiffValue(diff.from);
    const toValue = formatDiffValue(diff.to);
    if (fromValue === toValue) {
      summaries.push(`${toSentence(normalizedField)} updated`);
    } else {
      summaries.push(`${toSentence(normalizedField)} ${fromValue} → ${toValue}`);
    }
  });

  if (summaries.length === 0) {
    summaries.push('No item details changed');
  }

  return summaries;
}

export default function AuditLogPage({ shopId }: AuditLogPageProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (shopId) {
      loadAuditLogs();
    }
  }, [shopId]);

  const loadAuditLogs = async () => {
    if (!shopId) return;
    
    setLoading(true);
    try {
      // Load audit logs with item information
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .select(`
          *,
          merchant_items(
            name,
            price_cents,
            currency
          )
        `)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (auditError) {
        console.error('Error loading audit logs:', auditError);
        return;
      }

      if (auditData) {
        const transformedLogs: AuditLogEntry[] = auditData.map((log: any) => {
          // Handle both single item object and array
          const item = Array.isArray(log.merchant_items) 
            ? log.merchant_items[0] 
            : log.merchant_items;
          
          return {
            id: log.id,
            shop_id: log.shop_id,
            merchant_item_id: log.merchant_item_id,
            action_type: log.action_type,
            changed_fields: log.changed_fields || {},
            source: log.source || 'manual',
            actor: log.actor || { id: 'system', role: 'system' },
            created_at: log.created_at,
            item_name: item?.name || 'Unknown Item',
            item_price_cents: item?.price_cents || 0,
            item_currency: item?.currency || 'PKR',
          };
        });
        setAuditLogs(transformedLogs);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getItemDisplayName = (entry: AuditLogEntry) => {
    const name = entry.item_name || 'Unknown Item';
    const price = entry.item_price_cents ? formatPrice(entry.item_price_cents, entry.item_currency) : '';
    return price ? `${name} (${price})` : name;
  };

  const filteredLogs = auditLogs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (log.item_name && log.item_name.toLowerCase().includes(query)) ||
      (log.action_type && log.action_type.toLowerCase().includes(query)) ||
      (log.actor?.name && log.actor.name.toLowerCase().includes(query)) ||
      (log.actor?.email && log.actor.email.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading audit log...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by item name, action, or actor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Audit Log List */}
      <div className="space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <p className="text-gray-500 text-lg">
              {searchQuery ? 'No audit log entries found matching your search.' : 'No audit log entries yet.'}
            </p>
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const changeSummaries = buildChangeSummary(entry);
            const actionLabel = actionLabels[entry.action_type] || entry.action_type;
            
            return (
              <div
                key={entry.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">
                      {getItemDisplayName(entry)}
                    </h3>
                  </div>
                  <div className="text-sm text-gray-500 ml-4">
                    {formatDate(entry.created_at)}
                  </div>
                </div>
                
                <div className="mt-2">
                  <p className="text-sm text-gray-600 mb-1">{actionLabel}</p>
                  {changeSummaries.map((summary, index) => (
                    <p key={index} className="text-sm text-gray-600">
                      {summary}
                    </p>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

