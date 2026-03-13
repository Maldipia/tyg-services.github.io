'use client';
import React, { useState } from 'react';
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
    onAdd({ itemId: item.id, itemName: item.name, sizeId: selectedSize?.id ?? null,
      sizeLabel: selectedSize?.label ?? null, unitPrice: price, qty: 1, addons: [], addonTotal: 0, notes });
    setNotes('');
    setExpanded(false);
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0',
      overflow: 'hidden', opacity: isUnavailable ? 0.6 : 1,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Main row */}
      <div
        onClick={() => !isUnavailable && setExpanded(!expanded)}
        style={{ display: 'flex', gap: 12, padding: 14, cursor: isUnavailable ? 'default' : 'pointer' }}
      >
        {item.image_url && (
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: '#f5f5f5' }}>
            <Image src={item.image_url} alt={item.name} fill style={{ objectFit: 'cover' }} sizes="80px" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <h3 style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 14, lineHeight: 1.3, margin: 0 }}>{item.name}</h3>
              {item.tags.includes('bestseller') && (
                <span style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 20, marginTop: 4 }}>⭐ Bestseller</span>
              )}
            </div>
            {isUnavailable
              ? <span style={{ flexShrink: 0, fontSize: 12, color: '#ef4444', fontWeight: 500 }}>Sold Out</span>
              : <span style={{ flexShrink: 0, fontWeight: 700, color: '#16a34a', fontSize: 14 }}>₱{price.toFixed(2)}</span>
            }
          </div>
          {item.description && (
            <p style={{ color: '#6b7280', fontSize: 12, marginTop: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' as const }}>
              {item.description}
            </p>
          )}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && !isUnavailable && (
        <div style={{ padding: '12px 14px 14px', borderTop: '1px solid #f5f5f5' }}>
          {item.sizes && item.sizes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 8 }}>Choose size</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {item.sizes.filter(s => s.is_available).sort((a, b) => a.sort_order - b.sort_order).map(size => (
                  <button key={size.id} onClick={() => setSelectedSize(size)} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    border: selectedSize?.id === size.id ? '1.5px solid #16a34a' : '1px solid #e5e7eb',
                    background: selectedSize?.id === size.id ? '#f0fdf4' : '#fff',
                    color: selectedSize?.id === size.id ? '#16a34a' : '#374151',
                  }}>
                    {size.label} <span style={{ opacity: 0.7, fontSize: 11 }}>₱{size.price.toFixed(0)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            type="text" placeholder="Special instructions (optional)" value={notes}
            onChange={e => setNotes(e.target.value)} maxLength={200}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#374151', outline: 'none', marginBottom: 10 }}
          />
          <button onClick={handleAdd} style={{
            width: '100%', padding: '12px 0', background: '#16a34a', color: '#fff',
            borderRadius: 12, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
          }}>
            Add to Order — ₱{price.toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
}
