'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff, AlertCircle, X } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // State for reset password modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({ email: '', password: '' });
    setGeneralError('');

    // Validações
    const newErrors = { email: '', password: '' };
    let hasError = false;

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      newErrors.email = 'Email é obrigatório';
      hasError = true;
    } else if (!validateEmail(trimmedEmail)) {
      newErrors.email = 'Email inválido';
      hasError = true;
    }

    if (!password) {
      newErrors.password = 'Senha é obrigatória';
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      await signIn(trimmedEmail, password);
      router.push('/');
    } catch (error: any) {
      console.error('Erro ao fazer login:', error);
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('invalid') || message.includes('credentials')) {
        setGeneralError('Email ou senha incorretos. Verifique suas credenciais ou redefina sua senha.');
      } else {
        setGeneralError(error.message || 'Erro ao fazer login.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetMessage('');
    setResetError('');

    const trimmedResetEmail = resetEmail.trim();

    if (!validateEmail(trimmedResetEmail)) {
      setResetError('Por favor, insira um email válido.');
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(trimmedResetEmail);
      setResetMessage('Se uma conta com este email existir, um link para redefinição de senha foi enviado.');
    } catch (error: any) {
      console.error('Erro ao redefinir senha:', error);
      setResetError('Ocorreu um erro ao tentar redefinir a senha. Tente novamente.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#132440] to-[#16476A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card de Login */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo e Título */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#BF092F] rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-3xl">GI</span>
            </div>
            <h1 className="text-3xl font-bold text-[#212121] mb-2">GestãoInterna</h1>
            <p className="text-[#757575]">Dashboard Administrativo</p>
          </div>

          {/* Mensagem de erro geral */}
          {generalError && (
            <div className="mb-6 bg-[#BF092F]/10 border border-[#BF092F]/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#BF092F] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#BF092F]">{generalError}</p>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#212121] mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.email
                    ? 'border-[#BF092F] focus:ring-[#BF092F]/20'
                    : 'border-[#E0E0E0] focus:ring-[#3B9797]/30'
                }`}
                  placeholder="seu@email.com"
                  disabled={loading}
                />
              </div>
              {errors.email && (
              <p className="mt-1 text-sm text-[#BF092F]">{errors.email}</p>
              )}
            </div>

            {/* Senha */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-[#212121]">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                className="text-sm text-[#3B9797] hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-11 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.password
                    ? 'border-[#BF092F] focus:ring-[#BF092F]/20'
                    : 'border-[#E0E0E0] focus:ring-[#3B9797]/30'
                }`}
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#757575] hover:text-[#212121]"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
              <p className="mt-1 text-sm text-[#BF092F]">{errors.password}</p>
              )}
            </div>

            {/* Botão de Login */}
            <button
              type="submit"
              disabled={loading}
            className="w-full bg-[#BF092F] hover:bg-[#16476A] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Rodapé */}
          <div className="mt-6 text-center text-sm text-[#757575]">
            <button
              type="button"
              onClick={() => router.push('/criar-conta')}
              className="mb-2 inline-flex items-center justify-center text-sm font-semibold text-[#16476A] hover:underline"
            >
              Criar usuario inicial
            </button>
            <p>Versão 1.0.0</p>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-[#212121]">Redefinir Senha</h2>
              <button onClick={() => setShowResetModal(false)} className="text-gray-500 hover:text-gray-800">
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Digite seu email para receber um link de redefinição de senha.
            </p>
            <form onSubmit={handleResetPassword}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#212121] mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 border-[#E0E0E0] focus:ring-[#3B9797]/30"
                      placeholder="seu@email.com"
                      disabled={resetLoading}
                    />
                  </div>
                </div>
                {resetMessage && (
              <p className="text-sm text-[#3B9797]">{resetMessage}</p>
                )}
                <button
                  type="submit"
                  disabled={resetLoading}
              className="w-full bg-[#BF092F] hover:bg-[#16476A] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                >
                  {resetLoading ? 'Enviando...' : 'Enviar Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

