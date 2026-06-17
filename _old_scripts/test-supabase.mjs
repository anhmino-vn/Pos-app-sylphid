import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fdlbskgaogtbjrchtiso.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkbGJza2dhb2d0YmpyY2h0aXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzQwMjcsImV4cCI6MjA5NTgxMDAyN30.uEQs7QEFAe0DlDS-A6aNA7NT2CxyCh2SaG7s4dhH5vM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const defaultSettings = {
    id: 'global',
    business: { name: 'SYLPHID', logo: '', hotline: '', email: '', website: '', address: '', taxId: '' },
    invoice: { paperSize: '80mm', showLogo: true, footerText: 'Cảm ơn quý khách đã mua hàng!', returnPolicy: 'Đổi trả miễn phí trong 7 ngày' },
    payment: { allowCash: true, allowTransfer: true, bankName: '', bankAccountName: '', bankAccountNumber: '', defaultTransferContent: 'Thanh toan don hang' },
    inventory: { lowStockThreshold: 10, autoDeductOnPaid: true, autoRestockOnCancel: true },
    referral: { commissionMethod: 'PER_ORDER', tiers: [ { min: 0, max: 50000000, percent: 3 }, { min: 50000000, max: 100000000, percent: 5 }, { min: 100000000, max: 300000000, percent: 7 }, { min: 300000000, max: 9999999999, percent: 10 } ] },
    ui: { theme: 'light', primaryColor: 'blue' }
  };
  const { data, error } = await supabase.from('system_configs').upsert(defaultSettings);
  console.log("Error:", error);
}

check();
