import React from 'react';
import { Film, Tv, Sparkles, Plus } from 'lucide-react';

export interface FavoriteItem {
  id: string;
  type: 'movie' | 'series' | 'anime';
  title: string;
  posterUrl: string;
  year?: string;
  rating?: number;
}

interface TopFavoritesSectionProps {
  favorites?: {
    movies: FavoriteItem[];
    series: FavoriteItem[];
    anime: FavoriteItem[];
  };
  isEditable?: boolean;
  onItemSelect?: (category: 'movies' | 'series' | 'anime', slotIndex: number) => void;
}

export const TopFavoritesSection: React.FC<TopFavoritesSectionProps> = ({
  favorites = { movies: [], series: [], anime: [] },
  isEditable = false,
  onItemSelect,
}) => {
  const categories: { key: 'movies' | 'series' | 'anime'; label: string; icon: React.ReactNode }[] = [
    { key: 'movies', label: 'Top 4 Movies', icon: <Film className="w-4 h-4 text-amber-400" /> },
    { key: 'series', label: 'Top 4 Series', icon: <Tv className="w-4 h-4 text-blue-400" /> },
    { key: 'anime', label: 'Top 4 Anime', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
  ];

  return (
    <div className="w-full space-y-6 my-6 p-6 bg-surface/40 backdrop-blur-md rounded-2xl border border-border/50">
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-text flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          Favorites Showcase (Top 4)
        </h2>
        <span className="text-xs text-muted-text">Curated by user</span>
      </div>

      <div className="space-y-8">
        {categories.map((cat) => (
          <div key={cat.key} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
              {cat.icon}
              <span>{cat.label}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, index) => {
                const item = favorites[cat.key]?.[index];
                return (
                  <div
                    key={item?.id || `empty-${cat.key}-${index}`}
                    onClick={() => isEditable && onItemSelect?.(cat.key, index)}
                    className="relative group aspect-[2/3] rounded-xl overflow-hidden bg-surface-secondary/50 border border-border/40 transition-all duration-300 hover:border-accent hover:shadow-lg hover:shadow-accent/10 cursor-pointer"
                  >
                    {item ? (
                      <>
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                          <p className="text-xs font-bold text-white line-clamp-1">{item.title}</p>
                          {item.year && <p className="text-[10px] text-gray-300">{item.year}</p>}
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-text hover:text-text transition-colors p-2 text-center">
                        <Plus className="w-6 h-6 mb-1 opacity-50" />
                        <span className="text-[11px]">Select {cat.key.slice(0, -1)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopFavoritesSection;
