import React, { useState } from 'react';
import { X, Plus, ShoppingBag, Send, Check } from 'lucide-react';
import { Product } from '../../types/index.js';

interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  isBusinessOwner: boolean;
  onAddProduct: (prod: Partial<Product>) => void;
  onSendProductToChat?: (prod: Product) => void;
}

export const CatalogModal: React.FC<CatalogModalProps> = ({
  isOpen,
  onClose,
  products,
  isBusinessOwner,
  onAddProduct,
  onSendProductToChat,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    onAddProduct({
      name,
      description,
      price: parseFloat(price),
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      currency: 'USD',
      isAvailable: true,
    });
    setName('');
    setDescription('');
    setPrice('');
    setImageUrl('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3942] bg-[#111b21]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884]">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Business Catalog</h3>
              <p className="text-xs text-gray-400">Products & Services for WhatsApp Business</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-[#2a3942]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add Product Button */}
          {isBusinessOwner && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 px-4 border border-dashed border-[#00a884] rounded-xl text-[#00a884] font-medium flex items-center justify-center gap-2 hover:bg-[#00a884]/10 transition-colors"
            >
              <Plus className="w-5 h-5" /> Add New Item to Catalog
            </button>
          )}

          {/* Add Product Form */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="bg-[#111b21] p-4 rounded-xl border border-[#2a3942] space-y-3">
              <h4 className="text-sm font-semibold text-[#00a884]">New Catalog Item</h4>
              <input
                type="text"
                placeholder="Product Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-lg text-white text-sm focus:outline-none focus:border-[#00a884]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price (USD)"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-lg text-white text-sm focus:outline-none focus:border-[#00a884]"
                />
                <input
                  type="url"
                  placeholder="Image URL (optional)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-lg text-white text-sm focus:outline-none focus:border-[#00a884]"
                />
              </div>
              <textarea
                placeholder="Description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-lg text-white text-sm focus:outline-none focus:border-[#00a884]"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-lg text-xs font-semibold"
                >
                  Save Product
                </button>
              </div>
            </form>
          )}

          {/* Product Items Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map((p) => (
              <div
                key={p.id}
                className="bg-[#111b21] rounded-xl border border-[#2a3942] overflow-hidden flex flex-col justify-between hover:border-[#00a884]/40 transition-colors"
              >
                <img
                  src={p.imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'}
                  alt={p.name}
                  className="w-full h-36 object-cover bg-gray-800"
                />
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-white text-sm leading-snug">{p.name}</h4>
                      <span className="text-[#00a884] font-bold text-sm whitespace-nowrap">
                        ${p.price.toFixed(2)}
                      </span>
                    </div>
                    {p.description && (
                      <p className="text-xs text-gray-400 line-clamp-2 mb-3">{p.description}</p>
                    )}
                  </div>

                  {onSendProductToChat && (
                    <button
                      onClick={() => {
                        onSendProductToChat(p);
                        onClose();
                      }}
                      className="w-full mt-2 py-1.5 px-3 bg-[#00a884]/20 hover:bg-[#00a884] text-[#00a884] hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" /> Send to Customer Chat
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {products.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No items in the catalog yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
