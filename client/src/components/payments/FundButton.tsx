import { useState } from 'react';
import toast from 'react-hot-toast';
import { IndianRupee, ShieldCheck } from 'lucide-react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { paymentApi } from '../../api/paymentApi';
import { usePaymentConfig, useProjectMutation } from '../../hooks/queries/useProject';
import { useAppSelector } from '../../hooks/useRedux';
import type { CreateOrderInput, OrderResult } from '../../types';
import { formatCurrency, getErrorMessage } from '../../utils/helpers';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayCheckout {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: { error: { description?: string } }) => void) => void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

/** Loads Razorpay Checkout once, on first use. */
let checkoutScript: Promise<void> | null = null;
const loadCheckout = () =>
  (checkoutScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve();
    script.onerror = () => {
      checkoutScript = null;
      reject(new Error('Could not load Razorpay Checkout'));
    };
    document.body.appendChild(script);
  }));

/**
 * Funds escrow for a milestone (or an amount): creates the order, then opens Razorpay Checkout
 * (test mode) — or, in simulated mode, an in-app confirmation where no money moves.
 */
export function FundButton({ input, amount, label = 'Fund milestone', gigTitle }: { input: CreateOrderInput; amount: number; label?: string; gigTitle: string }) {
  const config = usePaymentConfig();
  const user = useAppSelector((s) => s.auth.user);
  const [simulatedOrder, setSimulatedOrder] = useState<OrderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const verify = useProjectMutation(paymentApi.verify);
  const simulate = useProjectMutation(paymentApi.simulate);

  if (config.data && !config.data.enabled) {
    return (
      <Button size="sm" variant="secondary" disabled title="Payments are not configured on this server">
        {label}
      </Button>
    );
  }

  const start = async () => {
    setBusy(true);
    try {
      const order = await paymentApi.createOrder(input);
      if (order.simulated) {
        setSimulatedOrder(order);
        return;
      }
      await loadCheckout();
      if (!window.Razorpay || !order.keyId) throw new Error('Razorpay Checkout is unavailable');
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.order.id,
        amount: order.order.amount,
        currency: order.order.currency,
        name: 'SkillSphere',
        description: `Escrow · ${gigTitle}`,
        prefill: { name: user ? `${user.firstName} ${user.lastName}` : undefined, email: user?.email },
        theme: { color: '#6366f1' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await verify.mutateAsync(response);
            toast.success('Payment received — funds are held in escrow');
          } catch (error) {
            toast.error(getErrorMessage(error, 'Payment verification failed'));
          }
        },
      });
      checkout.on('payment.failed', (r) => toast.error(r.error.description ?? 'Payment failed'));
      checkout.open();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not start the payment'));
    } finally {
      setBusy(false);
    }
  };

  const confirmSimulated = async () => {
    if (!simulatedOrder) return;
    try {
      await simulate.mutateAsync(simulatedOrder.payment._id);
      toast.success('Test payment captured — funds are held in escrow');
      setSimulatedOrder(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <>
      <Button size="sm" icon={<IndianRupee className="w-4 h-4" />} onClick={start} isLoading={busy || verify.isPending}>
        {label}
      </Button>
      <Modal isOpen={Boolean(simulatedOrder)} onClose={() => setSimulatedOrder(null)} title="Test checkout" size="sm">
        <div className="space-y-4">
          <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Simulated payment mode: no gateway is involved and no real money moves. Configure Razorpay test keys to use Checkout.
          </p>
          <p className="text-sm text-slate-300">
            Pay <span className="font-semibold text-white">{formatCurrency(amount)}</span> into escrow for “{gigTitle}”. It is released to the freelancer when
            you approve the work.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSimulatedOrder(null)}>Cancel</Button>
            <Button icon={<ShieldCheck className="w-4 h-4" />} onClick={confirmSimulated} isLoading={simulate.isPending}>
              Pay {formatCurrency(amount)}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
