'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import type { MenuItem, CartItem, MenuItemSize } from '@/types';

interface Props {
  item: MenuItem;
  onAdd: (item: CartItem) => void;
}

const SUGAR_OPTIONS: Array<{ value: 'GROUNDED'|'YANI'|'COMFORT'|'FULL_SWEET'; label: string; desc: string }> = [
  { value: 'GROUNDED',   label: 'Grounded',   desc: '25% — Light' },
  { value: 'YANI',       label: 'YANI',       desc: '50% — Signature' },
  { value: 'COMFORT',    label: 'Comfort',    desc: '75% — Rich' },
  { value: 'FULL_SWEET', label: 'Full Sweet', desc: '100% — Max' },
];

export default function MenuItemCard({ item, onAdd }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSize, setSelectedSize] = useState<MenuItemSize | null>(
    item.sizes?.find((s) => s.is_default) ?? item.sizes?.[0] ?? null
  );
  const [sugarLevel, setSugarLevel] = useState<'GROUNDED'|'YANI'|'COMFORT'|'FULL_SWEET'>('YANI');
  const [notes, setNotes] = useState('');

  const isUnavailable = item.status === 'SOLD_OUT';
  const price = selectedSize?.price ?? item.base_price;
  const hasSugar = item.has_sugar_level ?? false;

  const stockCount = item.stock_count;
  const lowThresh  = item.low_stock_threshold ?? 5;
  const showLow    = stockCount !== null && stockCount !== undefined && stockCount > 0 && stockCount <= lowThresh;

  const handleAdd = () => {
    onAdd({
      itemId: item.id, itemName: item.name,
      sizeId: selectedSize?.id ?? null, sizeLabel: selectedSize?.label ?? null,
      unitPrice: price, qty: 1, addons: [], addonTotal: 0, notes,
      ...(hasSugar ? { sugarLevel } : {}),
      hasSugarLevel: hasSugar,
    });
    setNotes('');
    setExpanded(false);
  };

  const displayTags = (item.tags ?? []).filter(t => t !== 'bestseller').slice(0, 3);

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0',
      overflow: 'hidden', opacity: isUnavailable ? 0.6 : 1,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      outline: item.is_featured ? '2px solid #f59e0b' : 'none',
    }}>
      <div onClick={() => !isUnavailable && setExpanded(!expanded)}
        style={{ display: 'flex', gap: 12, padding: 14, cursor: isUnavailable ? 'default' : 'pointer' }}>
        {item.image_url && (
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: '#f5f5f5' }}>
            <Image src={item.image_url} alt={item.name} fill style={{ objectFit: 'cover' }} sizes="80px" />
            {item.is_featured && (
              <div style={{ position:'absolute', top:4, left:4, background:'#f59e0b', borderRadius:4, fontSize:9, fontWeight:700, color:'#fff', padding:'1px 5px' }}>⭐</div>
            )}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 14, lineHeight: 1.3, margin: 0 }}>{item.name}</h3>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {item.tags.includes('bestseller') && <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>⭐ Bestseller</span>}
                {hasSugar && <span style={{ background: '#f0f9ff', color: '#0369a1', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>🧋 Sweetness</span>}
                {displayTags.map(tag => <span key={tag} style={{ background: '#f5f5f5', color: '#6b7280', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>{tag}</span>)}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {isUnavailable ? <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>Sold Out</span>
                : <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 14 }}>₱{price.toFixed(2)}</span>}
              {showLow && !isUnavailable && <div style={{ fontSize: 10, color: '#f97316', fontWeight: 600, marginTop: 2 }}>Only {stockCount} left</div>}
            </div>
          </div>
          {item.description && (
            <p style={{ color: '#6b7280', fontSize: 12, marginTop: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' as const }}>{item.description}</p>
          )}
        </div>
      </div>

      {expanded && !isUnavailable && (
        <div style={{ padding: '12px 14px 14px', borderTop: '1px solid #f5f5f5' }}>
          {item.sizes && item.sizes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Size</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {item.sizes.filter(s => s.is_available).sort((a, b) => a.sort_order - b.sort_order).map(size => (
                  <button key={size.id} onClick={() => setSelectedSize(size)} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    border: selectedSize?.id === size.id ? '1.5px solid #16a34a' : '1px solid #e5e7eb',
                    background: selectedSize?.id === size.id ? '#f0fdf4' : '#fff',
                    color: selectedSize?.id === size.id ? '#16a34a' : '#374151',
                  }}>{size.label} <span style={{ opacity: 0.7, fontSize: 11 }}>₱{size.price.toFixed(0)}</span></button>
                ))}
              </div>
            </div>
          )}

          {hasSugar && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>🧋 Sweetness Level</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {SUGAR_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setSugarLevel(opt.value)} style={{
                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left' as const,
                    border: sugarLevel === opt.value ? '1.5px solid #0369a1' : '1px solid #e5e7eb',
                    background: sugarLevel === opt.value ? '#f0f9ff' : '#fff',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: sugarLevel === opt.value ? '#0369a1' : '#374151' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <input type="text" placeholder="Special instructions (optional)" value={notes}
            onChange={e => setNotes(e.target.value)} maxLength={200}
            style={{ width: '100%', boxSizing: 'border-box' as const, border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#374151', outline: 'none', marginBottom: 10 }} />

          <button onClick={handleAdd} style={{
            width: '100%', padding: '12px 0', background: '#16a34a', color: '#fff',
            borderRadius: 12, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
          }}>Add to Order — ₱{price.toFixed(2)}</button>
        </div>
      )}
    </div>
  );
}
