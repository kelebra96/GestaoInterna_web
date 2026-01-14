'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ClearDBModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
}

const CONFIRMATION_TEXT = 'deletar banco de dados';

export default function ClearDBModal({ onClose, onConfirm, loading }: ClearDBModalProps) {
  const [confirmationInput, setConfirmationInput] = useState('');

  const isConfirmationMatching = confirmationInput === CONFIRMATION_TEXT;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-md">
        <div className="p-6 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-gray-900">Limpar Banco de Dados</h3>
          <div className="mt-2 text-sm text-gray-600">
            <p>
              Esta é uma ação <span className="font-bold text-red-600">irreversível</span>.
              Todos os dados, incluindo usuários, produtos, e solicitações, serão permanentemente removidos.
            </p>
            <p className="mt-4">
              Para confirmar, por favor, digite:
            </p>
            <p className="font-mono text-red-500 bg-red-50 rounded-md p-2 my-2 text-sm">
              {CONFIRMATION_TEXT}
            </p>
          </div>
          <input
            type="text"
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            className="w-full mt-4 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50"
            placeholder="Digite o texto de confirmação"
          />
        </div>
        <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-row-reverse rounded-b-xl">
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            onClick={onConfirm}
            disabled={!isConfirmationMatching || loading}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar e Limpar'}
          </button>
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
