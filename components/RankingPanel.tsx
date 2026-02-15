"use client";

import { useState } from 'react';
import { Trophy, Store, User, Package, TrendingUp, Crown, Medal, Award, ChevronRight } from 'lucide-react';

interface RankingItem {
  id: string;
  name: string;
  count: number;
  percentage?: number;
  details?: string;
}

interface RankingPanelProps {
  rankingPorLoja: RankingItem[];
  rankingPorComprador: RankingItem[];
  rankingPorProduto: RankingItem[];
  limit?: number;
}

type TabType = 'loja' | 'comprador' | 'produto';

const DS = {
  primary: '#16476A',
  primaryDark: '#132440',
  primaryMid: '#3B9797',
  secondary: '#5AB5B5',
  warning: '#BF092F',
  neutral400: '#E0E0E0',
  neutral500: '#757575',
};

const medalConfig = {
  0: {
    bg: 'linear-gradient(135deg, #FFD700, #FFA500)',
    border: '#FFD700',
    lightBg: 'bg-amber-50',
    lightBorder: 'border-amber-200',
    barBg: 'linear-gradient(90deg, #FFD700, #FFA500)',
    icon: Crown,
    label: '🥇',
    ring: 'ring-amber-200',
  },
  1: {
    bg: `linear-gradient(135deg, #94a3b8, #64748b)`,
    border: '#94a3b8',
    lightBg: 'bg-slate-50',
    lightBorder: 'border-slate-200',
    barBg: `linear-gradient(90deg, #94a3b8, #64748b)`,
    icon: Medal,
    label: '🥈',
    ring: 'ring-slate-200',
  },
  2: {
    bg: `linear-gradient(135deg, #f59e0b, #d97706)`,
    border: '#f59e0b',
    lightBg: 'bg-orange-50',
    lightBorder: 'border-orange-200',
    barBg: `linear-gradient(90deg, #f59e0b, #d97706)`,
    icon: Award,
    label: '🥉',
    ring: 'ring-orange-200',
  },
} as const;

export default function RankingPanel({
  rankingPorLoja,
  rankingPorComprador,
  rankingPorProduto,
  limit = 50,
}: RankingPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('produto');

  const tabs = [
    { id: 'produto' as TabType, label: 'Produtos', icon: Package, data: rankingPorProduto },
    { id: 'loja' as TabType, label: 'Lojas', icon: Store, data: rankingPorLoja },
    { id: 'comprador' as TabType, label: 'Compradores', icon: User, data: rankingPorComprador },
  ];

  const activeData = tabs.find((t) => t.id === activeTab)?.data || [];
  const topItems = activeData.slice(0, limit);
  const maxCount = topItems.length > 0 ? topItems[0].count : 1;

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div
        className="relative px-6 py-5 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${DS.primary}, ${DS.primaryDark})` }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%221%22%20fill%3D%22white%22%20fill-opacity%3D%220.06%22%2F%3E%3C%2Fsvg%3E')] opacity-100"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
              <Trophy className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Rankings Top {limit}</h3>
              <p className="text-white/50 text-sm mt-0.5">Frequência de solicitações por categoria</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-amber-400 border-2 border-white/30 -mr-1.5 z-[3]"></div>
            <div className="w-5 h-5 rounded-full bg-slate-300 border-2 border-white/30 -mr-1.5 z-[2]"></div>
            <div className="w-5 h-5 rounded-full bg-orange-400 border-2 border-white/30 z-[1]"></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-divider bg-surface-hover/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 relative flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all duration-200 border-b-2 ${
                isActive
                  ? 'text-primary-600 border-primary-500 bg-card'
                  : 'text-text-tertiary border-transparent hover:text-text-secondary hover:border-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-text-tertiary'
              }`}>
                {tab.data.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-6">
        {topItems.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 mx-auto text-gray-200 mb-3" />
            <p className="text-lg font-semibold text-text-primary">Nenhum dado disponível</p>
            <p className="text-sm text-text-tertiary mt-1">Ainda não há solicitações registradas</p>
          </div>
        ) : (
          <>
            {/* Podium — Top 3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {topItems.slice(0, 3).map((item, index) => {
                const medal = medalConfig[index as 0 | 1 | 2];
                const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                const MedalIcon = medal.icon;

                return (
                  <div
                    key={item.id}
                    className={`relative p-5 rounded-2xl border-2 ${medal.lightBg} ${medal.lightBorder} transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group/card`}
                  >
                    {/* Medal badge */}
                    <div className="absolute -top-3 -right-3 z-10">
                      <div
                        className="p-2 rounded-full shadow-lg ring-4 ring-white"
                        style={{ background: medal.bg }}
                      >
                        <MedalIcon className="w-4 h-4 text-white" />
                      </div>
                    </div>

                    {/* Position & Count */}
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="text-white w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-lg shadow-md"
                        style={{ background: medal.bg }}
                      >
                        {index + 1}
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-extrabold text-text-primary tabular-nums">{item.count}</div>
                        <div className="text-[11px] text-text-tertiary font-medium">solicitações</div>
                      </div>
                    </div>

                    {/* Name */}
                    <h4 className="font-semibold text-text-primary text-sm min-h-[40px] line-clamp-2 leading-snug">
                      {item.name}
                    </h4>
                    {item.details && (
                      <p className="text-xs text-text-tertiary mt-1 truncate">{item.details}</p>
                    )}

                    {/* Progress */}
                    <div className="mt-3 w-full bg-white/70 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out group-hover/card:w-full"
                        style={{ width: `${percentage}%`, background: medal.barBg }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Full Ranking List */}
            {topItems.length > 3 && (
              <div>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-divider">
                  <TrendingUp className="w-4 h-4 text-primary-500" />
                  <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-widest">
                    Ranking Completo
                  </h4>
                  <span className="text-[11px] text-text-tertiary ml-auto">{topItems.length} itens</span>
                </div>

                <div className="max-h-[460px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                  {topItems.slice(3).map((item, idx) => {
                    const index = idx + 3;
                    const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-hover hover:bg-gray-100 transition-colors duration-150 group/row"
                      >
                        {/* Position */}
                        <div className="w-8 h-8 rounded-lg bg-gray-200/70 flex items-center justify-center font-bold text-xs text-text-secondary flex-shrink-0">
                          {index + 1}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-text-primary text-sm truncate">{item.name}</p>
                          {item.details && <p className="text-xs text-text-tertiary truncate">{item.details}</p>}
                        </div>

                        {/* Progress — Hidden on mobile */}
                        <div className="hidden lg:flex items-center gap-2 w-32">
                          <div className="flex-1 bg-gray-200/70 rounded-full h-1 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%`, backgroundColor: DS.secondary }}
                            />
                          </div>
                        </div>

                        {/* Count */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-base font-extrabold text-primary-600 tabular-nums">{item.count}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
