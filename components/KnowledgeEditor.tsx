'use client';

import { useState, useEffect } from 'react';
import type { KnowledgeBase } from '@/lib/types';

interface KnowledgeEditorProps {
  article: KnowledgeBase | null;
  onSave: (article: Partial<KnowledgeBase>) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
}

export default function KnowledgeEditor({ article, onSave, onDelete, onCancel }: KnowledgeEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setContent(article.content);
      setCategory(article.category || '');
      setTags(article.tags.join(', '));
      setIsActive(article.isActive);
    } else {
      setTitle('');
      setContent('');
      setCategory('');
      setTags('');
      setIsActive(true);
    }
  }, [article]);

  const handleSave = () => {
    const tagArray = tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    onSave({
      title,
      content,
      category: category || undefined,
      tags: tagArray,
      isActive,
    });
  };

  const handleDelete = () => {
    if (article && onDelete) {
      onDelete(article.id);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm h-full flex flex-col">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{article ? 'Edit Article' : 'New Article'}</h2>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
            placeholder="Article title..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
            placeholder="e.g., Billing, Shipping, Returns..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
            placeholder="Comma-separated tags..."
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Separate tags with commas</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-96 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF] resize-none"
            placeholder="Write your article content here..."
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 text-[#7C5CFF] rounded focus:ring-2 focus:ring-[#7C5CFF]"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Active (visible to AI)
          </label>
        </div>
      </div>

      <div className="p-6 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!title || !content}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-[#7C5CFF] to-[#9F7BFF] text-white rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-[0_0_15px_rgba(124,92,255,0.4)]"
          >
            Save Article
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100"
          >
            Cancel
          </button>
          {article && onDelete && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
