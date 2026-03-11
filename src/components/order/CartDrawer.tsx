'use client';

import type { CartItem } from '@/types';

interface Props {
  open: boolean;
  cart: CartItem[];
  onClose: () => void;
  onRemove: (index: number) => void;
  onUpdateQty: (index: number, delta: number) => void;
  onCheckout: () => void;
  total: number;
  primaryColor: string;
}

export default function CartDrawer({
  open, cart, onClose, onRemove, onUpdateQty, onCheckout, total, primaryColor,
}: Props) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-lg">Your Order</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Items */}
        <div className="overflow-y-auto flex-1 px-6 py-2">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">🛒</div>
              <p>Your cart is empty</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {cart.map((item, idx) => (
                <li key={idx} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{item.itemName}</p>
                    {item.sizeLabel && (
                      <p className="text-xs text-gray-500">{item.sizeLabel}</p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-gray-400 italic">{item.notes}</p>
                    )}
                    <p className="text-sm font-semibold text-green-700 mt-0.5">
                      ₱{((item.unitPrice + item.addonTotal) * item.qty).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQty(idx, -1)}
                      className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-sm"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-semibold text-sm">{item.qty}</span>
                    <button
                      onClick={() => onUpdateQty(idx, 1)}
                      className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-sm"
                    >
                      +
                    </button>
                    <button
                      onClick={() => onRemove(idx)}
                      className="ml-1 text-red-400 hover:text-red-600 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Total + Checkout */}
        {cart.length > 0 && (
          <div className="px-6 py-5 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 font-medium">Subtotal</span>
              <span className="font-bold text-gray-800">
                ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-xs text-gray-400">VAT and final total shown at checkout</p>
            <button
              onClick={onCheckout}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-base"
              style={{ backgroundColor: primaryColor }}
            >
              Place Order
            </button>
          </div>
        )}
      </div>
    </>
  );
}
