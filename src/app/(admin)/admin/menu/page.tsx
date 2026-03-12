'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Image from 'next/image';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, GripVertical,
  ChevronRight, Tag, ImageIcon, AlertCircle, Check
} from 'lucide-react';
import type { MenuCategory, MenuItem, ItemStatus } from '@/types';

type Tab = 'categories' | 'items';

const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; bg: string }> = {
  AVAILABLE: { label: 'Available', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  SOLD_OUT:  { label: 'Sold Out',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  HIDDEN:    { label: 'Hidden',    color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

// ── Shared styles ─────────────────────────────────────────────
const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
};

const inputStyle = {
  width: '100%',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 14px',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  color: 'var(--text-muted)',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
};

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>('items');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [editCat, setEditCat] = useState<MenuCategory | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MenuItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = createBrowserClient();

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadMenu = useCallback(async () => {
    const res = await fetch('/api/menu?tenant=yani'); // tenant from session in production
    const data = await res.json() as { data: { categories: (MenuCategory & { items: MenuItem[] })[] } | null };
    if (data.data) {
      const cats = data.data.categories.map(c => ({
        id: c.id, tenant_id: c.tenant_id ?? '', branch_id: c.branch_id ?? null,
        created_at: c.created_at, updated_at: c.updated_at ?? c.created_at,
        name: c.name, description: c.description ?? null, image_url: c.image_url ?? null,
        sort_order: c.sort_order, is_active: c.is_active,
      } as MenuCategory));
      const allItems = data.data.categories.flatMap(c => c.items ?? []);
      setCategories(cats);
      setItems(allItems);
      if (!selectedCategory && cats.length > 0) setSelectedCategory(cats[0]?.id ?? null);
    }
    setLoading(false);
  }, [selectedCategory]);

  useEffect(() => { void loadMenu(); }, [loadMenu]);

  const deleteItem = async (item: MenuItem) => {
    setDeleting(true);
    const r = await fetch(`/api/menu/items/${item.id}`, { method: 'DELETE', credentials: 'include' });
    const json = await r.json() as { data?: { hidden?: boolean; reason?: string }; error?: string };
    setDeleting(false);
    setConfirmDelete(null);
    if (json.error) { showToast(json.error, 'err'); return; }
    if (json.data?.hidden) {
      showToast(`"${item.name}" marked as Hidden (has order history)`, 'ok');
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'HIDDEN' as ItemStatus } : i));
    } else {
      showToast(`"${item.name}" deleted`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    }
  };

  const filteredItems = selectedCategory
    ? items.filter(i => i.category_id === selectedCategory)
    : items;

  const toggleItemStatus = async (item: MenuItem) => {
    const next: ItemStatus = item.status === 'AVAILABLE' ? 'SOLD_OUT' : 'AVAILABLE';
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: next } : i));
    const r = await fetch(`/api/menu/items/${item.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    const json = await r.json() as { error?: string };
    if (json.error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: item.status } : i));
      showToast(json.error, 'err');
    } else {
      showToast(`${item.name} marked as ${next.toLowerCase().replace('_', ' ')}`);
    }
  };

  return (
    <div style={{ color: 'var(--text)' }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl"
          style={{
            background: toast.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: toast.type === 'ok' ? '#22c55e' : '#ef4444',
            backdropFilter: 'blur(8px)',
          }}
        >
          {toast.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          <span style={{ fontSize: 13, fontWeight: 500 }}>{toast.msg}</span>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)' }}>
          {(['items', 'categories'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize"
              style={tab === t
                ? { background: '#22c55e', color: 'white' }
                : { color: 'var(--text-muted)' }
              }
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => tab === 'items' ? setShowItemForm(true) : setShowCatForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}
        >
          <Plus size={15} />
          Add {tab === 'items' ? 'Item' : 'Category'}
        </button>
      </div>

      {/* ── Items Tab ─────────────────────────────────────── */}
      {tab === 'items' && (
        <div className="flex gap-4">
          {/* Category sidebar */}
          <div className="flex-shrink-0 w-48" style={cardStyle}>
            <div className="p-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Categories
              </span>
            </div>
            <nav className="p-2 space-y-0.5">
              <button
                onClick={() => setSelectedCategory(null)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all"
                style={!selectedCategory
                  ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 600 }
                  : { color: 'var(--text-muted)' }
                }
              >
                All Items
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{items.length}</span>
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all"
                  style={selectedCategory === cat.id
                    ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 600 }
                    : { color: 'var(--text-muted)' }
                  }
                >
                  <span className="truncate">{cat.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {items.filter(i => i.category_id === cat.id).length}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Items grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>Loading menu...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-16" style={cardStyle}>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                    <ImageIcon size={24} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No items in this category</p>
                  <button
                    onClick={() => setShowItemForm(true)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'var(--surface-2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}
                  >
                    + Add First Item
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredItems.map(item => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => { setEditItem(item); setShowItemForm(true); }}
                    onToggleStatus={() => toggleItemStatus(item)}
                    onDelete={() => setConfirmDelete(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Categories Tab ────────────────────────────────── */}
      {tab === 'categories' && (
        <div className="grid gap-3">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="flex items-center gap-4 p-4 rounded-2xl transition-all"
              style={cardStyle}
            >
              <GripVertical size={16} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                style={{ background: 'var(--surface-2)', color: '#22c55e' }}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontWeight: 600, fontSize: 15 }}>{cat.name}</div>
                {cat.description && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{cat.description}</div>
                )}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {items.filter(i => i.category_id === cat.id).length} items
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                  onClick={() => { setEditCat(cat); setShowCatForm(true); }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Item Form Modal ───────────────────────────────── */}
      {showItemForm && (
        <ItemFormModal
          item={editItem}
          categories={categories}
          onClose={() => { setShowItemForm(false); setEditItem(null); }}
          onSave={(msg) => { showToast(msg); void loadMenu(); }}
        />
      )}

      {/* ── Category Form Modal ───────────────────────────── */}
      {showCatForm && (
        <CategoryFormModal
          cat={editCat}
          onClose={() => { setShowCatForm(false); setEditCat(null); }}
          onSave={(msg) => { showToast(msg); void loadMenu(); }}
        />
      )}
      {/* ── Delete Confirmation Modal ────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <Trash2 size={22} style={{ color: '#ef4444' }} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>
                Delete &ldquo;{confirmDelete.name}&rdquo;?
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                If this item has order history, it will be hidden instead of permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void deleteItem(confirmDelete)}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: deleting ? 'var(--surface-3)' : 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function MenuItemRow({
  item, onEdit, onToggleStatus, onDelete,
}: {
  item: MenuItem;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const sc = STATUS_CONFIG[item.status];

  return (
    <div
      className="flex items-center gap-4 p-4 rounded-2xl transition-all group"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        opacity: item.status === 'HIDDEN' ? 0.6 : 1,
      }}
    >
      {/* Image */}
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
        {item.image_url ? (
          <Image src={item.image_url} alt={item.name} width={56} height={56} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</span>
          {item.is_featured && <Tag size={11} style={{ color: '#f59e0b' }} />}
        </div>
        {item.description && (
          <p className="truncate" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.description}</p>
        )}
        {item.tags.length > 0 && (
          <div className="flex gap-1 mt-1">
            {item.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'var(--surface-2)', color: 'var(--text-dim)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Price */}
      <div style={{ fontWeight: 800, fontSize: 16, color: '#22c55e', flexShrink: 0 }}>
        ₱{Number(item.base_price).toFixed(2)}
      </div>

      {/* Status toggle */}
      <button
        onClick={onToggleStatus}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0"
        style={{ background: sc.bg, color: sc.color }}
      >
        {sc.label}
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Item Form Modal ───────────────────────────────────────────
function ItemFormModal({
  item, categories, onClose, onSave,
}: {
  item: MenuItem | null;
  categories: MenuCategory[];
  onClose: () => void;
  onSave: (msg: string) => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [basePrice, setBasePrice] = useState(String(item?.base_price ?? ''));
  const [categoryId, setCategoryId] = useState(item?.category_id ?? categories[0]?.id ?? '');
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? 'AVAILABLE');
  const [isFeatured, setIsFeatured] = useState(item?.is_featured ?? false);
  const [imageUrl, setImageUrl] = useState<string | null>(item?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Only image files allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB per image'); return; }

    setUploading(true);
    const { createBrowserClient: createClient } = await import('@/lib/supabase/client');
    const sb = createClient();
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `menu/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await sb.storage.from('menu-images').upload(path, file, { upsert: false });
    if (error || !data) { alert('Upload failed: ' + (error?.message ?? 'unknown')); setUploading(false); return; }
    const { data: urlData } = sb.storage.from('menu-images').getPublicUrl(data.path);
    setImageUrl(urlData.publicUrl);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!name.trim() || !basePrice) return;
    setSaving(true);
    const url = item ? `/api/menu/items/${item.id}` : '/api/menu/items';
    const method = item ? 'PATCH' : 'POST';
    const r = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(), description: description.trim() || null,
        basePrice: parseFloat(basePrice), categoryId,
        status, isFeatured, imageUrl,
      }),
    });
    const json = await r.json() as { error?: string };
    setSaving(false);
    if (json.error) { onSave(json.error); return; }
    onSave(item ? `${name} updated` : `${name} added to menu`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>
            {item ? 'Edit Item' : 'Add Menu Item'}
          </h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Image Upload */}
          <div>
            <label style={labelStyle}>Photo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {imageUrl
                  ? <Image src={imageUrl} alt="preview" width={80} height={80} className="w-full h-full object-cover" />
                  : <ImageIcon size={22} style={{ color: 'var(--text-muted)' }} />
                }
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  id="menu-img-upload"
                  className="hidden"
                  onChange={e => void handleImageUpload(e)}
                />
                <label
                  htmlFor="menu-img-upload"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer inline-flex"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  <ImageIcon size={14} />
                  {uploading ? 'Uploading...' : imageUrl ? 'Change Photo' : 'Upload Photo'}
                </label>
                {imageUrl && (
                  <button
                    onClick={() => setImageUrl(null)}
                    className="mt-2 block text-xs"
                    style={{ color: '#ef4444' }}
                  >
                    Remove photo
                  </button>
                )}
                <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>JPG, PNG or WebP · Max 5MB</p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={labelStyle}>Item Name *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Iced Caramel Latte" />
          </div>

          {/* Category + Price row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Category *</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id} style={{ background: '#1e2535' }}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Base Price (₱) *</label>
              <input
                style={inputStyle}
                type="number" min="0" step="0.01"
                value={basePrice}
                onChange={e => setBasePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, resize: 'none' as const, minHeight: 72 }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short description of the item..."
              rows={3}
            />
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <div className="flex gap-2">
              {(['AVAILABLE', 'SOLD_OUT', 'HIDDEN'] as ItemStatus[]).map(s => {
                const sc = STATUS_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={status === s
                      ? { background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40` }
                      : { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                    }
                  >
                    {sc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Featured toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Featured Item</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Show ⭐ badge on menu</div>
            </div>
            <button
              onClick={() => setIsFeatured(!isFeatured)}
              className="w-12 h-6 rounded-full relative transition-all"
              style={{ background: isFeatured ? '#22c55e' : 'var(--surface-3)' }}
            >
              <div
                className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: isFeatured ? 26 : 4 }}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-5" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !basePrice || saving || uploading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: name.trim() && basePrice && !uploading ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'var(--surface-3)',
              color: name.trim() && basePrice && !uploading ? 'white' : 'var(--text-muted)',
            }}
          >
            {uploading ? 'Uploading...' : saving ? 'Saving...' : item ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category Form Modal ───────────────────────────────────────
function CategoryFormModal({
  cat, onClose, onSave,
}: {
  cat: MenuCategory | null;
  onClose: () => void;
  onSave: (msg: string) => void;
}) {
  const [name, setName] = useState(cat?.name ?? '');
  const [description, setDescription] = useState(cat?.description ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const url = cat ? `/api/menu/categories/${cat.id}` : '/api/menu/categories';
    const method = cat ? 'PATCH' : 'POST';
    const r = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
    });
    const json = await r.json() as { error?: string };
    setSaving(false);
    if (json.error) { onSave(json.error); return; }
    onSave(cat ? 'Category updated' : `"${name}" category created`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>
            {cat ? 'Edit Category' : 'New Category'}
          </h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 22 }}>×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label style={labelStyle}>Category Name *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Hot Drinks, Snacks, Meals" />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Optional short description" />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-5" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: name.trim() ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'var(--surface-3)',
              color: name.trim() ? 'white' : 'var(--text-muted)',
            }}
          >
            {saving ? 'Saving...' : cat ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </div>
    </div>
  );
}
