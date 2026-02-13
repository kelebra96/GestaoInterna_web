'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Save,
  ArrowLeft,
  Brain,
  Bell,
  Sliders,
  Calendar,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-client';

interface MLSettings {
  clusteringEnabled: boolean;
  clusteringFrequency: 'daily' | 'weekly' | 'monthly';
  minClusterSize: number;
  predictionsEnabled: boolean;
  predictionHorizonDays: number;
  confidenceThreshold: number;
  anomalyDetectionEnabled: boolean;
  anomalyThreshold: number;
  anomalySeverityAlerts: ('low' | 'medium' | 'high' | 'critical')[];
  recommendationsEnabled: boolean;
  autoGenerateRecommendations: boolean;
  recommendationFrequency: 'realtime' | 'hourly' | 'daily';
  emailNotifications: boolean;
  pushNotifications: boolean;
  notifyOnCriticalOnly: boolean;
}

const defaultSettings: MLSettings = {
  clusteringEnabled: true,
  clusteringFrequency: 'weekly',
  minClusterSize: 3,
  predictionsEnabled: true,
  predictionHorizonDays: 7,
  confidenceThreshold: 0.7,
  anomalyDetectionEnabled: true,
  anomalyThreshold: 3.0,
  anomalySeverityAlerts: ['high', 'critical'],
  recommendationsEnabled: true,
  autoGenerateRecommendations: true,
  recommendationFrequency: 'daily',
  emailNotifications: false,
  pushNotifications: true,
  notifyOnCriticalOnly: false,
};

export default function MLSettingsPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [settings, setSettings] = useState<MLSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (firebaseUser) {
      loadSettings();
    }
  }, [firebaseUser]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/ml/settings', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings({ ...defaultSettings, ...data.settings });
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/ml/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Falha ao salvar configuracoes');
      }

      showToast('success', 'Configuracoes salvas com sucesso!');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof MLSettings>(key: K, value: MLSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleSeverityAlert = (severity: 'low' | 'medium' | 'high' | 'critical') => {
    setSettings(prev => ({
      ...prev,
      anomalySeverityAlerts: prev.anomalySeverityAlerts.includes(severity)
        ? prev.anomalySeverityAlerts.filter(s => s !== severity)
        : [...prev.anomalySeverityAlerts, severity]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#3B9797] mb-6 animate-pulse">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <p className="text-xl font-bold text-[#212121]">Carregando configuracoes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl text-white font-bold animate-slideUp ${toast.type === 'success' ? 'bg-gradient-to-r from-[#4CAF50] to-[#2E7D32]' : 'bg-gradient-to-r from-[#BF092F] to-[#BF092F]'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {toast.message}
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden">
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
                <Settings className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Configuracoes de ML
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2">
                  Configure os parametros de inteligencia artificial
                </p>
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] hover:from-[#388E3C] hover:to-[#1B5E20] text-white px-6 py-3 rounded-xl font-bold shadow-lg border border-white/20 disabled:opacity-50 transition-all duration-300 hover:scale-105"
            >
              {saving ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? 'Salvando...' : 'Salvar Configuracoes'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Clustering */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Clusterizacao
              </h2>
              <p className="text-white/70 text-sm mt-1">Agrupamento automatico de lojas e produtos</p>
            </div>
            <div className="p-6 space-y-6">
              <label className="flex items-center justify-between">
                <span className="font-medium text-[#212121]">Habilitar clusterizacao automatica</span>
                <ToggleSwitch
                  checked={settings.clusteringEnabled}
                  onChange={(checked) => updateSetting('clusteringEnabled', checked)}
                />
              </label>

              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">Frequencia de atualizacao</label>
                <select
                  value={settings.clusteringFrequency}
                  onChange={(e) => updateSetting('clusteringFrequency', e.target.value as any)}
                  disabled={!settings.clusteringEnabled}
                  className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl text-[#212121] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium bg-white disabled:opacity-50 transition-all"
                >
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">
                  Tamanho minimo do cluster: <span className="text-[#3B9797]">{settings.minClusterSize}</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={settings.minClusterSize}
                  onChange={(e) => updateSetting('minClusterSize', parseInt(e.target.value))}
                  disabled={!settings.clusteringEnabled}
                  className="w-full h-2 bg-[#E0E0E0] rounded-lg appearance-none cursor-pointer disabled:opacity-50 accent-[#3B9797]"
                />
              </div>
            </div>
          </div>

          {/* Predictions */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#132440] to-[#16476A] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Predicoes
              </h2>
              <p className="text-white/70 text-sm mt-1">Previsoes de demanda e risco</p>
            </div>
            <div className="p-6 space-y-6">
              <label className="flex items-center justify-between">
                <span className="font-medium text-[#212121]">Habilitar predicoes</span>
                <ToggleSwitch
                  checked={settings.predictionsEnabled}
                  onChange={(checked) => updateSetting('predictionsEnabled', checked)}
                />
              </label>

              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">
                  Horizonte de predicao: <span className="text-[#16476A]">{settings.predictionHorizonDays} dias</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={settings.predictionHorizonDays}
                  onChange={(e) => updateSetting('predictionHorizonDays', parseInt(e.target.value))}
                  disabled={!settings.predictionsEnabled}
                  className="w-full h-2 bg-[#E0E0E0] rounded-lg appearance-none cursor-pointer disabled:opacity-50 accent-[#16476A]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">
                  Limite de confianca: <span className="text-[#16476A]">{(settings.confidenceThreshold * 100).toFixed(0)}%</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="0.99"
                  step="0.01"
                  value={settings.confidenceThreshold}
                  onChange={(e) => updateSetting('confidenceThreshold', parseFloat(e.target.value))}
                  disabled={!settings.predictionsEnabled}
                  className="w-full h-2 bg-[#E0E0E0] rounded-lg appearance-none cursor-pointer disabled:opacity-50 accent-[#16476A]"
                />
              </div>
            </div>
          </div>

          {/* Anomaly Detection */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#BF092F] to-[#8B0000] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Deteccao de Anomalias
              </h2>
              <p className="text-white/70 text-sm mt-1">Identificacao de padroes anormais</p>
            </div>
            <div className="p-6 space-y-6">
              <label className="flex items-center justify-between">
                <span className="font-medium text-[#212121]">Habilitar deteccao de anomalias</span>
                <ToggleSwitch
                  checked={settings.anomalyDetectionEnabled}
                  onChange={(checked) => updateSetting('anomalyDetectionEnabled', checked)}
                />
              </label>

              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">
                  Threshold Z-score: <span className="text-[#BF092F]">{settings.anomalyThreshold.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="1.5"
                  max="5"
                  step="0.1"
                  value={settings.anomalyThreshold}
                  onChange={(e) => updateSetting('anomalyThreshold', parseFloat(e.target.value))}
                  disabled={!settings.anomalyDetectionEnabled}
                  className="w-full h-2 bg-[#E0E0E0] rounded-lg appearance-none cursor-pointer disabled:opacity-50 accent-[#BF092F]"
                />
                <p className="text-xs text-[#757575] mt-1">
                  Menor = mais sensivel, Maior = menos falsos positivos
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#212121] mb-3">Alertar para severidades:</label>
                <div className="flex gap-2 flex-wrap">
                  {(['low', 'medium', 'high', 'critical'] as const).map((severity) => (
                    <button
                      key={severity}
                      onClick={() => toggleSeverityAlert(severity)}
                      disabled={!settings.anomalyDetectionEnabled}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                        settings.anomalySeverityAlerts.includes(severity)
                          ? severity === 'critical' ? 'bg-[#BF092F] text-white shadow-lg'
                          : severity === 'high' ? 'bg-[#FF9800] text-white shadow-lg'
                          : severity === 'medium' ? 'bg-[#F57C00] text-white shadow-lg'
                          : 'bg-[#3B9797] text-white shadow-lg'
                          : 'bg-[#F8F9FA] text-[#757575] border-2 border-[#E0E0E0]'
                      }`}
                    >
                      {severity === 'low' ? 'Baixa' : severity === 'medium' ? 'Media' : severity === 'high' ? 'Alta' : 'Critica'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5" />
                Recomendacoes
              </h2>
              <p className="text-white/70 text-sm mt-1">Sugestoes automaticas de acao</p>
            </div>
            <div className="p-6 space-y-6">
              <label className="flex items-center justify-between">
                <span className="font-medium text-[#212121]">Habilitar recomendacoes</span>
                <ToggleSwitch
                  checked={settings.recommendationsEnabled}
                  onChange={(checked) => updateSetting('recommendationsEnabled', checked)}
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="font-medium text-[#212121]">Gerar recomendacoes automaticamente</span>
                <ToggleSwitch
                  checked={settings.autoGenerateRecommendations}
                  onChange={(checked) => updateSetting('autoGenerateRecommendations', checked)}
                  disabled={!settings.recommendationsEnabled}
                />
              </label>

              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">Frequencia de geracao</label>
                <select
                  value={settings.recommendationFrequency}
                  onChange={(e) => updateSetting('recommendationFrequency', e.target.value as any)}
                  disabled={!settings.recommendationsEnabled || !settings.autoGenerateRecommendations}
                  className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl text-[#212121] focus:outline-none focus:ring-2 focus:ring-[#FF9800] focus:border-[#FF9800] font-medium bg-white disabled:opacity-50 transition-all"
                >
                  <option value="realtime">Tempo real</option>
                  <option value="hourly">A cada hora</option>
                  <option value="daily">Diario</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications - Full width */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#3B9797] to-[#4CAF50] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notificacoes
              </h2>
              <p className="text-white/70 text-sm mt-1">Alertas e avisos do sistema de ML</p>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-3 gap-6">
                <label className="flex items-center justify-between p-4 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                  <span className="font-medium text-[#212121]">Notificacoes por e-mail</span>
                  <ToggleSwitch
                    checked={settings.emailNotifications}
                    onChange={(checked) => updateSetting('emailNotifications', checked)}
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                  <span className="font-medium text-[#212121]">Notificacoes push</span>
                  <ToggleSwitch
                    checked={settings.pushNotifications}
                    onChange={(checked) => updateSetting('pushNotifications', checked)}
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                  <span className="font-medium text-[#212121]">Apenas alertas criticos</span>
                  <ToggleSwitch
                    checked={settings.notifyOnCriticalOnly}
                    onChange={(checked) => updateSetting('notifyOnCriticalOnly', checked)}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toggle Switch Component
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-[#3B9797]' : 'bg-[#E0E0E0]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
