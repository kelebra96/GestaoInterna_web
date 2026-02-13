'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  ArrowLeft,
  RefreshCw,
  Plus,
  TrendingUp,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSeasonality } from '@/hooks/usePrediction';

// Traducoes para tipos
const translateEntityType = (type: string): string => {
  const translations: Record<string, string> = {
    'organization': 'Organizacao',
    'store': 'Loja',
    'product': 'Produto',
    'category': 'Categoria',
  };
  return translations[type] || type;
};

const translateMetricType = (type: string): string => {
  const translations: Record<string, string> = {
    'loss_rate': 'Taxa de Perda',
    'loss_value': 'Valor de Perda',
    'loss_quantity': 'Qtd. Perdida',
    'rupture_rate': 'Taxa de Ruptura',
    'expiry_rate': 'Taxa de Vencimento',
    'sales': 'Vendas',
    'demand': 'Demanda',
    'inventory': 'Estoque',
  };
  return translations[type] || type;
};

export default function SazonalidadePage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const { patterns, events, loading, error, fetchPatterns, fetchEvents, createEvent } = useSeasonality();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    eventName: '',
    eventType: 'promotion' as 'holiday' | 'promotion' | 'season' | 'custom',
    eventDate: '',
    impactFactor: 1.2,
  });

  useEffect(() => {
    if (firebaseUser) {
      fetchPatterns();
      fetchEvents(60);
    }
  }, [firebaseUser, fetchPatterns, fetchEvents]);

  const handleCreateEvent = async () => {
    if (!newEvent.eventName || !newEvent.eventDate) return;

    await createEvent({
      eventName: newEvent.eventName,
      eventType: newEvent.eventType,
      eventDate: new Date(newEvent.eventDate),
      impactFactor: newEvent.impactFactor,
      recurrence: 'none',
    });

    setShowCreateModal(false);
    setNewEvent({
      eventName: '',
      eventType: 'promotion',
      eventDate: '',
      impactFactor: 1.2,
    });
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  };

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'daily': return <Sun className="w-5 h-5" />;
      case 'weekly': return <Calendar className="w-5 h-5" />;
      case 'monthly': return <Moon className="w-5 h-5" />;
      case 'yearly': return <Sparkles className="w-5 h-5" />;
      default: return <TrendingUp className="w-5 h-5" />;
    }
  };

  const eventTypeColors: Record<string, string> = {
    holiday: 'bg-[#BF092F]/10 text-[#BF092F]',
    promotion: 'bg-[#4CAF50]/10 text-[#4CAF50]',
    season: 'bg-[#16476A]/10 text-[#16476A]',
    custom: 'bg-[#757575]/10 text-[#757575]',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-[#212121] mb-4">Novo Evento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">Nome do Evento</label>
                <input
                  type="text"
                  value={newEvent.eventName}
                  onChange={(e) => setNewEvent({ ...newEvent, eventName: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B9797] focus:border-[#3B9797]"
                  placeholder="Ex: Black Friday"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">Tipo</label>
                <select
                  value={newEvent.eventType}
                  onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value as any })}
                  className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B9797] focus:border-[#3B9797]"
                >
                  <option value="promotion">Promocao</option>
                  <option value="holiday">Feriado</option>
                  <option value="season">Estacao</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">Data</label>
                <input
                  type="date"
                  value={newEvent.eventDate}
                  onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B9797] focus:border-[#3B9797]"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">
                  Multiplicador de Impacto: {newEvent.impactFactor.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={newEvent.impactFactor}
                  onChange={(e) => setNewEvent({ ...newEvent, impactFactor: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-[#E0E0E0] rounded-lg appearance-none cursor-pointer accent-[#3B9797]"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 border-2 border-[#E0E0E0] text-[#757575] rounded-xl font-bold hover:bg-[#F8F9FA]"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateEvent}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#3B9797] to-[#4CAF50] text-white rounded-xl font-bold"
              >
                Criar Evento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#3B9797] via-[#4CAF50] to-[#4CAF50] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <button
                onClick={() => router.push('/inteligencia')}
                className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/20 transition-all"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                <Calendar className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Sazonalidade
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2">
                  Padroes sazonais e eventos de calendario
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 bg-white text-[#3B9797] px-5 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                Novo Evento
              </button>
              <button
                onClick={() => { fetchPatterns(); fetchEvents(60); }}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 disabled:opacity-50 transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Patterns */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Padroes Detectados
              </h2>
            </div>
            <div className="p-6">
              {loading && patterns.length === 0 ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 text-[#757575] animate-spin mx-auto mb-2" />
                  <p className="text-[#757575]">Carregando padroes...</p>
                </div>
              ) : patterns.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-[#E0E0E0] mx-auto mb-2" />
                  <p className="text-[#757575]">Nenhum padrao sazonal detectado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patterns.map((pattern) => (
                    <div key={pattern.id} className="p-4 bg-gradient-to-r from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-[#16476A]/10 rounded-lg text-[#16476A]">
                            {getPatternIcon(pattern.patternType)}
                          </div>
                          <div>
                            <p className="font-bold text-[#212121]">
                              {pattern.patternType === 'daily' ? 'Diario' :
                               pattern.patternType === 'weekly' ? 'Semanal' :
                               pattern.patternType === 'monthly' ? 'Mensal' :
                               pattern.patternType === 'yearly' ? 'Anual' :
                               pattern.patternType}
                            </p>
                            <p className="text-xs text-[#757575]">{translateEntityType(pattern.entityType)} - {translateMetricType(pattern.metricType)}</p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-[#3B9797]">
                          {(pattern.strength * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#3B9797] to-[#16476A] rounded-full transition-all"
                          style={{ width: `${pattern.strength * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Events */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#3B9797] to-[#4CAF50] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Proximos Eventos
              </h2>
            </div>
            <div className="p-6">
              {loading && events.length === 0 ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 text-[#757575] animate-spin mx-auto mb-2" />
                  <p className="text-[#757575]">Carregando eventos...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-[#E0E0E0] mx-auto mb-2" />
                  <p className="text-[#757575]">Nenhum evento cadastrado</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-[#3B9797] to-[#4CAF50] text-white px-4 py-2 rounded-lg font-bold text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Criar Evento
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0]">
                      <div className="flex items-center gap-3">
                        {event.eventDate && (
                          <div className="text-center px-3 py-2 bg-[#16476A]/10 rounded-lg">
                            <p className="text-lg font-bold text-[#16476A]">
                              {new Date(event.eventDate).getDate()}
                            </p>
                            <p className="text-xs text-[#757575]">
                              {new Date(event.eventDate).toLocaleDateString('pt-BR', { month: 'short' })}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-[#212121]">{event.eventName}</p>
                          <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-lg ${eventTypeColors[event.eventType] || eventTypeColors.custom}`}>
                            {event.eventType === 'holiday' ? 'Feriado' :
                             event.eventType === 'promotion' ? 'Promocao' :
                             event.eventType === 'season' ? 'Estacao' : 'Personalizado'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#3B9797]">{event.impactFactor?.toFixed(1)}x</p>
                        <p className="text-xs text-[#757575]">impacto</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
