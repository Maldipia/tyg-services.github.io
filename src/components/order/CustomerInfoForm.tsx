'use client';

interface Props {
  customerName: string;
  customerPhone: string;
  pax: number;
  notes: string;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangePax: (v: number) => void;
  onChangeNotes: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  cartTotal: number;
}

export default function CustomerInfoForm({
  customerName, customerPhone, pax, notes,
  onChangeName, onChangePhone, onChangePax, onChangeNotes,
  onBack, onSubmit, submitting, cartTotal,
}: Props) {
  const canSubmit = customerName.trim().length > 0 && !submitting;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={onBack} className="text-green-600 text-sm mb-4 flex items-center gap-1">
        ← Back to Menu
      </button>

      <h2 className="text-xl font-bold text-gray-800 mb-6">Your Information</h2>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="e.g. Maria Santos"
            maxLength={100}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
        </div>

        {/* Phone (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Mobile Number <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => onChangePhone(e.target.value)}
            placeholder="09xxxxxxxxx"
            maxLength={20}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
        </div>

        {/* Pax */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Number of Guests
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onChangePax(Math.max(1, pax - 1))}
              className="w-10 h-10 rounded-full bg-gray-100 font-bold text-gray-700 flex items-center justify-center"
            >
              −
            </button>
            <span className="text-xl font-bold text-gray-800 w-8 text-center">{pax}</span>
            <button
              onClick={() => onChangePax(Math.min(50, pax + 1))}
              className="w-10 h-10 rounded-full bg-gray-100 font-bold text-gray-700 flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Order Notes <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => onChangeNotes(e.target.value)}
            placeholder="Allergies, special requests..."
            maxLength={500}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none"
          />
        </div>

        {/* Total summary */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-gray-600 font-medium">Order Total</span>
          <span className="font-bold text-green-700 text-lg">
            ₱{cartTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <p className="text-xs text-gray-400 -mt-3">+ VAT included in final total</p>

        {/* Submit */}
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`w-full py-4 rounded-2xl font-bold text-white text-base transition-all ${
            canSubmit ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Placing Order...' : 'Confirm Order →'}
        </button>
      </div>
    </div>
  );
}
