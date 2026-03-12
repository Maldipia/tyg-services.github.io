'use client';
import React from 'react';

import { useState } from 'react';
import Image from 'next/image';
import type { MenuItem, CartItem, MenuItemSize } from '@/types';

interface Props {
  item: MenuItem;
  onAdd: (item: CartItem) => void;
}

export default function MenuItemCard({ item, onAdd }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSize, setSelectedSize] = useState<MenuItemSize | null>(
    item.sizes?.find((s) => s.is_default) ?? item.sizes?.[0] ?? null
  );
  const [notes, setNotes] = useState('');

  const isUnavailable = item.status === 'SOLD_OUT';
  const price = selectedSize?.price ?? item.base_price;

  const handleAdd = () => {
    onAdd({
      itemId: item.id,
      itemName: item.name,
      sizeId: selectedSize?.id ?? null,
      sizeLabel: selectedSize?.label ?? null,
      unitPrice: price,
      qty: 1,
      addons: [],
      addonTotal: 0,
      notes,
    });
    setNotes('');
    setExpanded(false);
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all ${
        isUnavailable ? 'opacity-60' : ''
      }`}
    >
      <div
        className="flex gap-3 p-4 cursor-pointer"
        onClick={() => !isUnavailable && setExpanded(!expanded)}
      >
        {/* Image */}
        {item.image_url && (
          <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm leading-tight">
                {item.name}
              </h3>
              {item.tags.includes('bestseller') && (
                <span className="inline-block bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full mt-1">
                  ⭐ Bestseller
                </span>
              )}
            </div>
            {isUnavailable ? (
              <span className="flex-shrink-0 text-xs text-red-500 font-medium">Sold Out</span>
            ) : (
              <span className="flex-shrink-0 font-bold text-green-700 text-sm">
                ₱{price.toFixed(2)}
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.description}</p>
          )}
        </div>
      </div>

      {/* Expanded: size selection + add button */}
      {expanded && !isUnavailable && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
          {/* Size selector */}
          {item.sizes && item.sizes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Choose size</p>
              <div className="flex gap-2 flex-wrap">
                {item.sizes
                  .filter((s) => s.is_available)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((size) => (
                    <button
                      key={size.id}
                      onClick={() => setSelectedSize(size)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        selectedSize?.id === size.id
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {size.label}
                      <span className="ml-1 text-xs opacity-70">₱{size.price.toFixed(0)}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Special instructions */}
          <div>
            <input
              type="text"
              placeholder="Special instructions (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Add to cart */}
          <button
            onClick={handleAdd}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            Add to Order — ₱{price.toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
}
