'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const statusColors = {
  pending: 'bg-[#FF9800]/10 text-[#FF9800] border-[#FF9800]/30',
  batched: 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/30',
  closed: 'bg-[#647CAC]/10 text-[#647CAC] border-[#647CAC]/30',
};

const statusLabels = {
  pending: 'Pendente',
  batched: 'Agrupada',
  closed: 'Fechada',
};

export default function RecentSolicitacoes({ solicitacoes }: RecentSolicitacoesProps) {
  return (
    <div className="bg-[#FFFFFF] rounded-xl shadow-md overflow-hidden border border-[#E0E0E0]">
      <div className="px-6 py-4 bg-gradient-to-r from-[#1F53A2] to-[#5C94CC]">
        <h3 className="text-lg font-bold text-white">Solicitações Recentes</h3>
        <p className="text-sm text-[#E3EFFF] mt-1">
          Últimas {solicitacoes.length} solicitações criadas no sistema
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E0E0E0]">
          <thead className="bg-[#F5F5F5]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-[#757575] uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-[#757575] uppercase tracking-wider">Usuário</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-[#757575] uppercase tracking-wider">Loja</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-[#757575] uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-[#757575] uppercase tracking-wider">Data</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#E0E0E0]">
            {solicitacoes.map((solicitacao) => (
              <tr key={solicitacao.id} className="hover:bg-[#E3EFFF]/30 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-[#1F53A2] rounded-full mr-3" />
                    <span className="text-sm font-mono font-semibold text-[#212121]">
                      {solicitacao.id.slice(0, 8)}...
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-[#212121]">{solicitacao.userName}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-[#757575]">{solicitacao.storeName}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full border ${statusColors[solicitacao.status as keyof typeof statusColors]}`}>
                    {statusLabels[solicitacao.status as keyof typeof statusLabels]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#757575]">
                  {format(new Date(solicitacao.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {solicitacoes.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-block w-16 h-16 bg-[#E3EFFF] rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🙂</span>
          </div>
          <p className="text-[#757575]">Nenhuma solicitação encontrada</p>
        </div>
      )}
    </div>
  );
}
