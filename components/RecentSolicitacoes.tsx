'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, Store, Hash, CalendarDays, Inbox } from 'lucide-react';

interface Solicitacao {
  id: string;
  status: string;
  createdAt: string;
  userName: string;
  storeName: string;
}

interface RecentSolicitacoesProps {
  solicitacoes: Solicitacao[];
}

const statusConfig = {
  pending: {
    label: 'Pendente',
    bg: 'bg-error-100',
    text: 'text-error-700',
    dot: 'bg-error-500',
    border: 'border-error-200',
  },
  batched: {
    label: 'Agrupada',
    bg: 'bg-success-100',
    text: 'text-success-700',
    dot: 'bg-success-500',
    border: 'border-success-200',
  },
  closed: {
    label: 'Fechada',
    bg: 'bg-primary-100',
    text: 'text-primary-700',
    dot: 'bg-primary-500',
    border: 'border-primary-200',
  },
};

export default function RecentSolicitacoes({ solicitacoes }: RecentSolicitacoesProps) {
  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden border border-border">
      {/* Header */}
      <div className="relative px-6 py-5 overflow-hidden" style={{ background: 'linear-gradient(135deg, #16476A, #3B9797)' }}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%221%22%20fill%3D%22white%22%20fill-opacity%3D%220.06%22%2F%3E%3C%2Fsvg%3E')] opacity-100"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Solicitações Recentes</h3>
              <p className="text-white/50 text-sm mt-0.5">
                Últimas {solicitacoes.length} solicitações do sistema
              </p>
            </div>
          </div>
          <div className="hidden sm:block px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10">
            <span className="text-sm font-bold text-white">{solicitacoes.length}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-surface-hover/60">
              <th className="px-5 py-3 text-left">
                <div className="flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-text-tertiary" />
                  <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">ID</span>
                </div>
              </th>
              <th className="px-5 py-3 text-left">
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-text-tertiary" />
                  <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Usuário</span>
                </div>
              </th>
              <th className="px-5 py-3 text-left">
                <div className="flex items-center gap-1.5">
                  <Store className="w-3 h-3 text-text-tertiary" />
                  <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Loja</span>
                </div>
              </th>
              <th className="px-5 py-3 text-left">
                <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Status</span>
              </th>
              <th className="px-5 py-3 text-left">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3 text-text-tertiary" />
                  <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Data</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {solicitacoes.map((s, idx) => {
              const cfg = statusConfig[s.status as keyof typeof statusConfig] ?? statusConfig.pending;
              const createdAt = new Date(s.createdAt);

              return (
                <tr
                  key={s.id}
                  className="hover:bg-primary-50/30 transition-colors duration-150 group"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary-400 rounded-full opacity-40 group-hover:opacity-100 transition-opacity" />
                      <span className="text-sm font-mono font-semibold text-text-primary">
                        {s.id.slice(0, 8)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="text-sm font-medium text-text-primary">{s.userName}</span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="text-sm text-text-secondary">{s.storeName}</span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div>
                      <span className="text-sm text-text-primary font-medium">
                        {format(createdAt, "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="text-xs text-text-tertiary ml-1.5">
                        {format(createdAt, "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-tertiary mt-0.5">
                      {formatDistanceToNow(createdAt, { addSuffix: true, locale: ptBR })}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {solicitacoes.length === 0 && (
        <div className="text-center py-16 px-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 rounded-2xl mb-4">
            <Inbox className="w-8 h-8 text-primary-300" />
          </div>
          <p className="text-base font-semibold text-text-primary">Nenhuma solicitação</p>
          <p className="text-sm text-text-tertiary mt-1">Novas solicitações aparecerão aqui</p>
        </div>
      )}
    </div>
  );
}
