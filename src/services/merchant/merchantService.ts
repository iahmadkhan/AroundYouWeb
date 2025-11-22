import { supabase, type SupabaseClientType } from '../supabase';

export type ShopType = 'grocery' | 'meat' | 'vegetable' | 'mart' | 'other';
export type MerchantStatus = 'none' | 'pending' | 'verified';
export type NumberOfShops = '1' | '2' | '3+';

export interface MerchantAccount {
  id: string;
  user_id: string;
  shop_type: ShopType;
  number_of_shops: NumberOfShops;
  status: MerchantStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateMerchantAccountData {
  shop_type: ShopType;
  number_of_shops: NumberOfShops;
}

// Create merchant account
export async function createMerchantAccount(
  userId: string,
  data: CreateMerchantAccountData
): Promise<{ merchant: MerchantAccount | null; error: { message: string } | null }> {
  try {
    const client = supabase as SupabaseClientType;
    
    // Add timeout to prevent hanging
    const insertPromise = client.from('merchant_accounts').insert({
      user_id: userId,
      shop_type: data.shop_type,
      number_of_shops: data.number_of_shops,
      status: 'none',
    });

    const timeoutPromise = new Promise<{ error: any }>((resolve) => {
      setTimeout(() => {
        resolve({ error: { message: 'Operation timeout', code: 'TIMEOUT' } });
      }, 5000); // 5 second timeout
    });

    const { error } = await Promise.race([
      insertPromise.then(result => ({ error: result.error })),
      timeoutPromise
    ]);

    if (error) {
      if (error.code === 'TIMEOUT') {
        return { merchant: null, error: { message: 'Operation is taking too long. Please try again.' } };
      }
      return { merchant: null, error: { message: error.message } };
    }

    // We don't need to fetch the full row here; dashboard will load it via queries
    return { merchant: null, error: null };
  } catch (error: any) {
    return { merchant: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Get merchant account by user ID
export async function getMerchantAccount(
  userId: string
): Promise<{ merchant: MerchantAccount | null; error: { message: string } | null }> {
  try {
    const client = supabase as SupabaseClientType;
    const { data: merchant, error } = await client
      .from('merchant_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return { merchant: null, error: { message: error.message } };
    }

    if (error && error.code === 'PGRST116') {
      return { merchant: null, error: null }; // No merchant account found, not an error
    }

    return { merchant, error: null };
  } catch (error: any) {
    return { merchant: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Update merchant status
export async function updateMerchantStatus(
  merchantId: string,
  status: MerchantStatus
): Promise<{ error: { message: string } | null }> {
  try {
    const client = supabase as SupabaseClientType;
    const { error } = await client
      .from('merchant_accounts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', merchantId);

    if (error) {
      return { error: { message: error.message } };
    }

    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || 'An error occurred' } };
  }
}

