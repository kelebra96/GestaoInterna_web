"use client";

import { useState } from 'react';
import { Trophy, Store, User, Package, TrendingUp } from 'lucide-react';

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

export default function RankingPanel({
  rankingPorLoja,
  rankingPorComprador,
  rankingPorProduto,
  limit = 50,
}: RankingPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('produto');

  const tabs = [
    { id: 'produto' as TabType, label: 'Por Produto', icon: Package, data: rankingPorProduto },
    { id: 'loja' as TabType, label: 'Por Loja', icon: Store, data: rankingPorLoja },
    { id: 'comprador' as TabType, label: 'Por Comprador', icon: User, data: rankingPorComprador },
  ];

  const activeData = tabs.find((t) => t.id === activeTab)?.data || [];
  const topItems = activeData.slice(0, limit);
  const maxCount = topItems.length > 0 ? topItems[0].count : 1;

  // Cores para medalhas
  const getMedalColor = (index: number) => {
    if (index === 0) return 'bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-white'; // Ouro
    if (index === 1) return 'bg-gradient-to-br from-[#C0C0C0] to-[#A8A8A8] text-white'; // Prata
    if (index === 2) return 'bg-gradient-to-br from-[#CD7F32] to-[#8B4513] text-white'; // Bronze
    return 'bg-[#F5F5F5] text-[#757575]';
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1F53A2] to-[#5C94CC] p-6">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Ranking Top {limit}</h3>
            <p className="text-[#E3EFFF] text-sm">Itens com mais frequência de solicitações</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E0E0E0] bg-[#F5F5F5]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-white text-[#1F53A2] border-b-2 border-[#1F53A2]'
                  : 'text-[#757575] hover:text-[#1F53A2] hover:bg-white/50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-[#1F53A2]/10 text-xs font-bold">
                {tab.data.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-6">
        {topItems.length === 0 ? (
          <div className="text-center py-12 text-[#757575]">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">Nenhum dado disponível</p>
            <p className="text-sm mt-1">Ainda não há solicitações registradas</p>
          </div>
        ) : (
          <>
            {/* Top 3 Destaque */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {topItems.slice(0, 3).map((item, index) => {
                const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border-2 ${
                      index === 0
                        ? 'border-[#FFD700] bg-gradient-to-br from-[#FFD700]/5 to-[#FFA500]/5'
                        : index === 1
                        ? 'border-[#C0C0C0] bg-gradient-to-br from-[#C0C0C0]/5 to-[#A8A8A8]/5'
                        : 'border-[#CD7F32] bg-gradient-to-br from-[#CD7F32]/5 to-[#8B4513]/5'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className={`${getMedalColor(index)} w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-md`}>
                        {index + 1}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[#1F53A2]">{item.count}</div>
                        <div className="text-xs text-[#757575]">solicitações</div>
                      </div>
                    </div>
                    <h4 className="font-semibold text-[#212121] text-sm mb-1 line-clamp-2">{item.name}</h4>
                    {item.details && <p className="text-xs text-[#757575] mb-2">{item.details}</p>}
                    <div className="w-full bg-[#E0E0E0] rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          index === 0
                            ? 'bg-gradient-to-r from-[#FFD700] to-[#FFA500]'
                            : index === 1
                            ? 'bg-gradient-to-r from-[#C0C0C0] to-[#A8A8A8]'
                            : 'bg-gradient-to-r from-[#CD7F32] to-[#8B4513]'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lista Completa */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#1F53A2]" />
                <h4 className="text-sm font-semibold text-[#757575] uppercase tracking-wide">
                  Ranking Completo
                </h4>
              </div>

              <div className="max-h-[600px] overflow-y-auto pr-2 space-y-1">
                {topItems.map((item, index) => {
                  const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  const isTopThree = index < 3;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                        isTopThree
                          ? 'bg-[#1F53A2]/5 hover:bg-[#1F53A2]/10'
                          : 'bg-[#F5F5F5] hover:bg-[#E0E0E0]'
                      }`}
                    >
                      {/* Posição */}
                      <div
                        className={`${getMedalColor(index)} w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm`}
                      >
                        {index + 1}
                      </div>

                      {/* Nome e Detalhes */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#212121] text-sm truncate">{item.name}</p>
                        {item.details && <p className="text-xs text-[#757575] truncate">{item.details}</p>}
                      </div>

                      {/* Barra de Progresso */}
                      <div className="hidden md:flex items-center gap-2 w-32">
                        <div className="flex-1 bg-[#E0E0E0] rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-[#1F53A2] rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Contagem */}
                      <div className="text-right flex-shrink-0 w-20">
                        <div className="text-lg font-bold text-[#1F53A2]">{item.count}</div>
                        <div className="text-xs text-[#757575]">itens</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
