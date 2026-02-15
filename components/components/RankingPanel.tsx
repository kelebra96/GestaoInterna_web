"use client";

import { useState } from 'react';
import { Trophy, Store, User, Package, TrendingUp, Crown, Medal, Award } from 'lucide-react';

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

// Cores da paleta do projeto
const colors = {
  primary: '#1F53A2',
  primaryLight: '#E3EFFF',
  primaryDark: '#153D7A',
  secondary: '#5C94CC',
  accent: '#E82129',
  tertiary: '#647CAC',
  neutral: '#BFC7C9',
  success: '#4CAF50',
  warning: '#FF9800',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
  border: '#BFC7C9',
  divider: '#E0E0E0',
};

// Configuração de medalhas com cores do projeto
const medalConfig = {
  gold: {
    bg: { background: 'linear-gradient(to bottom right, #FFD700, #FFA500)' },
    border: { borderColor: '#FFD700' },
    light: { backgroundColor: '#FFFDE7' },
    bar: { background: 'linear-gradient(to right, #FFD700, #FFA500)' },
    icon: Crown,
  },
  silver: {
    bg: { background: `linear-gradient(to bottom right, ${colors.neutral}, ${colors.tertiary})` },
    border: { borderColor: colors.neutral },
    light: { backgroundColor: '#F5F5F5' },
    bar: { background: `linear-gradient(to right, ${colors.neutral}, ${colors.tertiary})` },
    icon: Medal,
  },
  bronze: {
    bg: { background: `linear-gradient(to bottom right, ${colors.warning}, #E65100)` },
    border: { borderColor: colors.warning },
    light: { backgroundColor: '#FFF3E0' },
    bar: { background: `linear-gradient(to right, ${colors.warning}, #F57C00)` },
    icon: Award,
  },
};

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

  const getMedalStyle = (index: number) => {
    if (index === 0) return medalConfig.gold;
    if (index === 1) return medalConfig.silver;
    if (index === 2) return medalConfig.bronze;
    return null;
  };

  return (
    <div style={{ backgroundColor: colors.surface, borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', border: `1px solid ${colors.divider}`, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(to right, ${colors.primary}, ${colors.primaryDark}, ${colors.secondary})`, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '12px' }}>
              <Trophy style={{ width: '24px', height: '24px', color: '#FFD700' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#FFFFFF', margin: 0 }}>Ranking Top {limit}</h3>
              <p style={{ color: colors.primaryLight, fontSize: '14px', margin: '4px 0 0 0' }}>Análise de frequência de solicitações</p>
            </div>
          </div>
          <div className="hidden sm:flex" style={{ alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ display: 'flex' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#FFD700', border: `2px solid ${colors.primaryDark}`, marginRight: '-4px', zIndex: 3 }}></div>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: colors.neutral, border: `2px solid ${colors.primaryDark}`, marginRight: '-4px', zIndex: 2 }}></div>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: colors.warning, border: `2px solid ${colors.primaryDark}`, zIndex: 1 }}></div>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: '500', marginLeft: '4px' }}>Top 3</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', backgroundColor: colors.background, borderBottom: `1px solid ${colors.divider}` }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '16px',
                fontWeight: '500',
                transition: 'all 0.2s',
                position: 'relative',
                backgroundColor: isActive ? colors.surface : 'transparent',
                color: isActive ? colors.primary : colors.textSecondary,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isActive && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', backgroundColor: colors.primary }}></div>
              )}
              <Icon style={{ width: '18px', height: '18px' }} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span style={{
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 'bold',
                backgroundColor: isActive ? colors.primaryLight : colors.divider,
                color: isActive ? colors.primary : colors.textSecondary,
              }}>
                {tab.data.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {topItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: colors.background, marginBottom: '16px' }}>
              <Trophy style={{ width: '40px', height: '40px', color: colors.neutral }} />
            </div>
            <p style={{ fontSize: '18px', fontWeight: '600', color: colors.textPrimary }}>Nenhum dado disponível</p>
            <p style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '4px' }}>Ainda não há solicitações registradas</p>
          </div>
        ) : (
          <>
            {/* Podium - Top 3 */}
            <div style={{ gap: '16px', marginBottom: '32px' }} className="grid grid-cols-1 md:grid-cols-3">
              {topItems.slice(0, 3).map((item, index) => {
                const medal = getMedalStyle(index);
                if (!medal) return null;
                const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                const MedalIcon = medal.icon;

                return (
                  <div
                    key={item.id}
                    style={{
                      position: 'relative',
                      padding: '20px',
                      borderRadius: '16px',
                      border: '2px solid',
                      ...medal.border,
                      ...medal.light,
                      transition: 'all 0.3s',
                    }}
                    className="hover:shadow-lg hover:-translate-y-1"
                  >
                    {/* Ribbon */}
                    <div style={{ position: 'absolute', top: '-12px', right: '-12px' }}>
                      <div style={{ ...medal.bg, padding: '8px', borderRadius: '50%', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
                        <MedalIcon style={{ width: '16px', height: '16px', color: '#FFFFFF' }} />
                      </div>
                    </div>

                    {/* Position & Count */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div style={{ ...medal.bg, color: '#FFFFFF', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '20px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        {index + 1}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '30px', fontWeight: 'bold', color: colors.textPrimary }}>{item.count}</div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: '500' }}>solicitações</div>
                      </div>
                    </div>

                    {/* Name */}
                    <h4 style={{ fontWeight: '600', color: colors.textPrimary, fontSize: '14px', marginBottom: '4px', minHeight: '40px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {item.name}
                    </h4>
                    {item.details && (
                      <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.details}</p>
                    )}

                    {/* Progress Bar */}
                    <div style={{ width: '100%', backgroundColor: colors.divider, borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                      <div
                        style={{ height: '100%', borderRadius: '9999px', transition: 'all 0.7s', width: `${percentage}%`, ...medal.bar }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Full List */}
            {topItems.length > 3 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: `1px solid ${colors.divider}` }}>
                  <TrendingUp style={{ width: '18px', height: '18px', color: colors.primary }} />
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Ranking Completo
                  </h4>
                  <span style={{ fontSize: '12px', color: colors.neutral }}>({topItems.length} itens)</span>
                </div>

                <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                  {topItems.slice(3).map((item, idx) => {
                    const index = idx + 3;
                    const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '12px',
                          borderRadius: '12px',
                          backgroundColor: colors.background,
                          marginBottom: '8px',
                          transition: 'background-color 0.15s',
                        }}
                        className="hover:bg-slate-100"
                      >
                        {/* Position */}
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: colors.divider, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', color: colors.textSecondary, flexShrink: 0 }}>
                          {index + 1}
                        </div>

                        {/* Name & Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: '500', color: colors.textPrimary, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                          {item.details && (
                            <p style={{ fontSize: '12px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.details}</p>
                          )}
                        </div>

                        {/* Progress Bar - Hidden on mobile */}
                        <div className="hidden lg:flex" style={{ alignItems: 'center', gap: '8px', width: '144px' }}>
                          <div style={{ flex: 1, backgroundColor: colors.divider, borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                            <div
                              style={{ height: '100%', backgroundColor: colors.secondary, borderRadius: '9999px', transition: 'all 0.5s', width: `${percentage}%` }}
                            />
                          </div>
                          <span style={{ fontSize: '12px', color: colors.neutral, width: '32px', textAlign: 'right' }}>
                            {Math.round(percentage)}%
                          </span>
                        </div>

                        {/* Count */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: colors.primary }}>{item.count}</div>
                          <div style={{ fontSize: '12px', color: colors.neutral }}>itens</div>
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
