'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import supabase from '@/lib/supabase-client';

type Status = 'checking' | 'ready' | 'success' | 'error';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession?.user) {
          if (active) {
            setStatus('ready');
          }
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        } else {
          await supabase.auth.getSession();
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          throw new Error('Link de recuperacao invalido ou expirado.');
        }

        if (active) {
          setStatus('ready');
        }
      } catch (err: any) {
        if (active) {
          setStatus('error');
          setError(err?.message || 'Nao foi possivel validar o link.');
        }
      }
    };

    init();
    return () => {
      active = false;
    };
  }, [code]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!password || password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem.');
      return;
    }

    try {
      setLoading(true);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }

      setStatus('success');
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar senha.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#132440] to-[#16476A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#3B9797] rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#212121] mb-2">Redefinir Senha</h1>
            <p className="text-[#757575] text-sm">Crie uma nova senha para sua conta</p>
          </div>

          {status === 'checking' && (
            <div className="flex items-center gap-3 text-[#16476A] text-sm font-semibold">
              <Loader2 className="w-5 h-5 animate-spin" />
              Validando link de recuperacao...
            </div>
          )}

          {status === 'error' && (
            <div className="bg-[#BF092F]/10 border border-[#BF092F]/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#BF092F] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[#BF092F]">
                <p className="font-semibold">Nao foi possivel continuar</p>
                <p>{error || 'Solicite um novo link de recuperacao.'}</p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="bg-[#3B9797]/10 border border-[#3B9797]/30 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#3B9797] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[#3B9797]">
                <p className="font-semibold">Senha atualizada com sucesso</p>
                <p>Use sua nova senha para acessar o sistema.</p>
              </div>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-[#BF092F]/10 border border-[#BF092F]/30 rounded-lg p-3 text-sm text-[#BF092F]">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#212121] mb-2">
                  Nova senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B9797]/30"
                    placeholder="Digite a nova senha"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#757575] hover:text-[#212121]"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#212121] mb-2">
                  Confirmar senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B9797]/30"
                    placeholder="Repita a nova senha"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#757575] hover:text-[#212121]"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#BF092F] hover:bg-[#16476A] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Atualizando...' : 'Atualizar senha'}
              </button>
            </form>
          )}

          {(status === 'error' || status === 'success') && (
            <button
              onClick={handleGoToLogin}
              className="mt-6 w-full border border-[#E0E0E0] text-[#16476A] font-semibold py-3 rounded-lg hover:bg-[#F5F5F5] transition-colors"
            >
              Voltar para o login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
