'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  MdPerson,
  MdEmail,
  MdBusiness,
  MdStore,
  MdPhotoCamera,
  MdSecurity,
  MdVpnKey,
  MdCheckCircle,
  MdError,
  MdUpload,
  MdEdit,
  MdVerifiedUser,
  MdLock,
  MdInfo,
  MdCloudUpload,
  MdImage,
  MdWarning
} from 'react-icons/md';
import { FaUserCircle, FaShieldAlt, FaCamera, FaLock, FaCheck, FaExclamationCircle } from 'react-icons/fa';
import { IoMdRefresh } from 'react-icons/io';
import supabase from '@/lib/supabase-client';

export default function PerfilPage() {
  const { user, firebaseUser, loading: authLoading, refreshUser } = useAuth();

  // State for store and company names
  const [storeName, setStoreName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');

  // State for photo upload
  const [newProfilePic, setNewProfilePic] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState('');

  // State for password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Fetch store and company names
  useEffect(() => {
    if (!user || !firebaseUser) return;

    const abortController = new AbortController();
    const { signal } = abortController;

    const fetchStoreAndCompanyNames = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        if (user.storeId) {
          try {
            const res = await fetch(`/api/lojas/${encodeURIComponent(user.storeId)}`, { headers, cache: 'no-store', signal });
            if (signal.aborted) return;
            if (res.ok) {
              const data = await res.json();
              setStoreName(data?.loja?.name || user.storeId);
            } else {
              setStoreName(user.storeId);
            }
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return;
            console.error('Error fetching store:', error);
            setStoreName(user.storeId);
          }
        }

        if (user.companyId) {
          try {
            const res = await fetch(`/api/empresas/${encodeURIComponent(user.companyId)}`, { headers, cache: 'no-store', signal });
            if (signal.aborted) return;
            if (res.ok) {
              const data = await res.json();
              setCompanyName(data?.empresa?.name || user.companyId);
            } else {
              setCompanyName(user.companyId);
            }
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return;
            console.error('Error fetching company:', error);
            setCompanyName(user.companyId);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Error in fetchStoreAndCompanyNames:', error);
      }
    };

    fetchStoreAndCompanyNames();

    return () => {
      abortController.abort();
    };
  }, [user, firebaseUser]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Client-side validation
      if (!file.type.startsWith('image/')) {
        setPhotoError('Por favor, selecione um arquivo de imagem.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB
        setPhotoError('A imagem não pode ser maior que 5MB.');
        return;
      }

      setPhotoError('');
      setPhotoSuccess('');
      setNewProfilePic(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadPhoto = async () => {
    if (!newProfilePic || !firebaseUser) {
      setPhotoError('Selecione uma imagem primeiro.');
      return;
    }

    setUploading(true);
    setPhotoError('');
    setPhotoSuccess('');

    try {
      const bucket = 'profile-photos';
      const fileExt = newProfilePic.name.split('.').pop() || 'jpg';
      const filePath = `${firebaseUser.uid}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, newProfilePic, {
          cacheControl: '3600',
          upsert: true,
          contentType: newProfilePic.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const publicUrl = publicData.publicUrl;

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateError) {
        throw updateError;
      }

      await refreshUser();

      setPhotoSuccess('Foto de perfil atualizada com sucesso!');
      setNewProfilePic(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      setPhotoError('Ocorreu um erro ao enviar a imagem. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword || !currentPassword || !confirmPassword) {
      setPasswordError('Por favor, preencha todos os campos.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter no m¡nimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('A nova senha e a confirma‡Æo nÆo coincidem.');
      return;
    }
    if (!firebaseUser || !firebaseUser.email) {
      setPasswordError('Usu rio nÆo autenticado corretamente.');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: firebaseUser.email,
        password: currentPassword,
      });
      if (signInError) {
        setPasswordError('A senha atual est  incorreta.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setPasswordError(updateError.message || 'Ocorreu um erro ao alterar a senha.');
        return;
      }

      setPasswordSuccess('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error(error);
      setPasswordError('Ocorreu um erro ao alterar a senha. Tente novamente.');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (authLoading || !user || !firebaseUser) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <IoMdRefresh className="h-8 w-8 animate-spin text-[#16476A]" />
        <p className="ml-4 text-[#757575] font-medium">Carregando perfil...</p>
      </div>
    );
  }

  const profileImageUrl = previewUrl || firebaseUser?.photoURL;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#132440] overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                <MdPerson className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-lg">Meu Perfil</h1>
                <p className="text-[#E0E7EF] text-sm mt-1 font-medium">Gerencie suas informações e configurações de conta</p>
              </div>
            </div>
          </div>

          {/* Profile Header Card */}
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 p-8 hover:shadow-3xl transition-all duration-500">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8">
              {/* Avatar Section */}
              <div className="relative group">
                <div className="relative">
                  {profileImageUrl ? (
                    <div className="relative">
                      <img
                        src={profileImageUrl}
                        alt="Foto de Perfil"
                        className="w-40 h-40 rounded-3xl object-cover ring-4 ring-white shadow-2xl transition-all duration-300 group-hover:ring-[#3B9797] group-hover:scale-105"
                      />
                      <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-[#16476A]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  ) : (
                    <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-[#3B9797] to-[#16476A] flex items-center justify-center ring-4 ring-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
                      <FaUserCircle className="w-24 h-24 text-white/90" />
                    </div>
                  )}
                  <div className="absolute -bottom-3 -right-3 bg-gradient-to-br from-[#3B9797] to-[#16476A] p-3 rounded-xl shadow-xl border-4 border-white group-hover:scale-110 transition-transform duration-300">
                    <MdVerifiedUser className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center lg:text-left">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
                  <h2 className="text-3xl font-bold text-[#212121]">{user.displayName}</h2>
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#E0E7EF] to-[#3B9797]/10 text-[#16476A] rounded-full text-sm font-bold border-2 border-[#3B9797]/30 shadow-md hover:shadow-lg transition-all duration-300">
                    <FaShieldAlt className="w-4 h-4" />
                    {user.role || 'Usuário'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="group/card flex items-center gap-3 p-4 bg-gradient-to-br from-[#F5F5F5] to-white rounded-xl hover:from-[#E0E7EF] hover:to-white transition-all duration-300 border border-[#E0E0E0] hover:border-[#3B9797]/30 hover:shadow-lg cursor-pointer">
                    <div className="p-3 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-xl shadow-md group-hover/card:shadow-lg transition-shadow duration-300">
                      <MdEmail className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-xs text-[#757575] font-semibold uppercase tracking-wide">Email</p>
                      <p className="text-sm text-[#212121] font-bold truncate">{user.email}</p>
                    </div>
                  </div>

                  {user.storeId && (
                    <div className="group/card flex items-center gap-3 p-4 bg-gradient-to-br from-[#F5F5F5] to-white rounded-xl hover:from-[#E0E7EF] hover:to-white transition-all duration-300 border border-[#E0E0E0] hover:border-[#3B9797]/30 hover:shadow-lg cursor-pointer">
                      <div className="p-3 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-xl shadow-md group-hover/card:shadow-lg transition-shadow duration-300">
                        <MdStore className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-xs text-[#757575] font-semibold uppercase tracking-wide">Loja</p>
                        <p className="text-sm text-[#212121] font-bold truncate">{storeName || user.storeId}</p>
                      </div>
                    </div>
                  )}

                  {user.companyId && (
                    <div className="group/card flex items-center gap-3 p-4 bg-gradient-to-br from-[#F5F5F5] to-white rounded-xl hover:from-[#E0E7EF] hover:to-white transition-all duration-300 border border-[#E0E0E0] hover:border-[#3B9797]/30 hover:shadow-lg cursor-pointer">
                      <div className="p-3 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-xl shadow-md group-hover/card:shadow-lg transition-shadow duration-300">
                        <MdBusiness className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-xs text-[#757575] font-semibold uppercase tracking-wide">Empresa</p>
                        <p className="text-sm text-[#212121] font-bold truncate">{companyName || user.companyId}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Photo Upload Card */}
          <div className="group/upload bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-[#E0E0E0] hover:border-[#3B9797]/50 overflow-hidden transform hover:-translate-y-1">
            {/* Card Header */}
            <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#132440] p-6 overflow-hidden">
              <div className="absolute inset-0" style={{
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='0.05'%3E%3Ccircle cx='2' cy='2' r='1'/%3E%3C/g%3E%3C/svg%3E\")"
              }}></div>
              <div className="relative flex items-center gap-4">
                <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border-2 border-white/40 shadow-xl group-hover/upload:scale-110 transition-transform duration-300">
                  <FaCamera className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white drop-shadow-md">Foto de Perfil</h3>
                  <p className="text-[#E0E7EF] text-sm font-medium">Personalize sua aparência</p>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-6 bg-gradient-to-b from-white to-[#F5F5F5]">
              <div className="space-y-6">
                {/* Preview Area */}
                {previewUrl && (
                  <div className="relative animate-fade-in">
                    <div className="text-sm font-bold text-[#212121] mb-4 flex items-center gap-2">
                      <MdEdit className="w-5 h-5 text-[#16476A]" />
                      Pré-visualização
                    </div>
                    <div className="flex justify-center">
                      <div className="relative inline-block group/preview">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-40 h-40 rounded-2xl object-cover ring-4 ring-[#E0E7EF] shadow-xl group-hover/preview:ring-[#3B9797] transition-all duration-300"
                        />
                        <div className="absolute -top-3 -right-3 bg-gradient-to-br from-[#3B9797] to-[#16476A] p-2.5 rounded-xl shadow-lg border-2 border-white">
                          <FaCheck className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* File Input */}
                <div>
                  <label className="block text-sm font-bold text-[#212121] mb-3 flex items-center gap-2">
                    <MdImage className="w-5 h-5 text-[#16476A]" />
                    Selecione uma nova imagem
                  </label>
                  <div className="relative">
                    <input
                      id="profile-picture"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="profile-picture"
                      className="flex flex-col items-center justify-center gap-3 w-full p-6 border-2 border-dashed border-[#BFC7C9] rounded-2xl hover:border-[#16476A] hover:bg-[#E0E7EF]/40 transition-all duration-300 cursor-pointer group/file bg-white"
                    >
                      <div className="p-4 bg-[#E0E7EF] rounded-2xl group-hover/file:bg-[#3B9797] transition-colors duration-300">
                        <MdCloudUpload className="w-8 h-8 text-[#16476A] group-hover/file:text-white transition-colors duration-300" />
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-bold text-[#212121] group-hover/file:text-[#16476A] transition-colors block">
                          {newProfilePic ? newProfilePic.name : 'Clique ou arraste uma imagem'}
                        </span>
                        <span className="text-xs text-[#757575] mt-1 block">PNG, JPG ou JPEG até 5MB</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Upload Button */}
                <button
                  onClick={handleUploadPhoto}
                  disabled={uploading || !newProfilePic}
                  className="group/btn w-full py-4 px-6 bg-gradient-to-r from-[#16476A] via-[#3B9797] to-[#16476A] bg-size-200 bg-pos-0 hover:bg-pos-100 text-white rounded-xl shadow-lg hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center gap-3 transition-all duration-500 font-bold text-base"
                  style={{ backgroundSize: '200% auto' }}
                >
                  {uploading ? (
                    <>
                      <IoMdRefresh className="w-6 h-6 animate-spin" />
                      <span>Enviando Imagem...</span>
                    </>
                  ) : (
                    <>
                      <MdUpload className="w-6 h-6 group-hover/btn:scale-110 transition-transform duration-300" />
                      <span>Atualizar Foto de Perfil</span>
                    </>
                  )}
                </button>

                {/* Messages */}
                {photoError && (
                  <div className="flex items-start gap-3 p-4 bg-[#BF092F]/10 border-l-4 border-[#BF092F] rounded-xl shadow-md animate-fade-in">
                    <FaExclamationCircle className="w-5 h-5 text-[#BF092F] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[#BF092F] font-semibold">{photoError}</p>
                  </div>
                )}
                {photoSuccess && (
                  <div className="flex items-start gap-3 p-4 bg-[#3B9797]/10 border-l-4 border-[#3B9797] rounded-xl shadow-md animate-fade-in">
                    <MdCheckCircle className="w-5 h-5 text-[#3B9797] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[#3B9797] font-semibold">{photoSuccess}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="group/security bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-[#E0E0E0] hover:border-[#3B9797]/50 overflow-hidden transform hover:-translate-y-1">
            {/* Card Header */}
            <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#132440] p-6 overflow-hidden">
              <div className="absolute inset-0" style={{
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='0.05'%3E%3Ccircle cx='2' cy='2' r='1'/%3E%3C/g%3E%3C/svg%3E\")"
              }}></div>
              <div className="relative flex items-center gap-4">
                <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border-2 border-white/40 shadow-xl group-hover/security:scale-110 transition-transform duration-300">
                  <FaShieldAlt className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white drop-shadow-md">Segurança da Conta</h3>
                  <p className="text-[#E0E7EF] text-sm font-medium">Proteja seu acesso</p>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-6 bg-gradient-to-b from-white to-[#F5F5F5]">
              <div className="space-y-6">
                {/* Security Info Banner */}
                <div className="relative bg-gradient-to-r from-[#E0E7EF] via-white to-[#3B9797]/10 p-5 rounded-2xl border-2 border-[#3B9797]/20 shadow-sm overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#3B9797]/5 rounded-full -mr-16 -mt-16"></div>
                  <div className="relative flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-xl shadow-md">
                      <MdInfo className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#212121]">Dica de Segurança</p>
                      <p className="text-xs text-[#757575] mt-1 leading-relaxed">Use uma senha forte com letras, números e símbolos (mínimo 6 caracteres)</p>
                    </div>
                  </div>
                </div>

                {/* Current Password */}
                <div>
                  <label htmlFor="current-password" className="block text-sm font-bold text-[#212121] mb-3 flex items-center gap-2">
                    <FaLock className="w-4 h-4 text-[#16476A]" />
                    Senha Atual
                  </label>
                  <div className="relative group/input">
                    <input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="block w-full pl-12 pr-4 py-4 bg-white text-[#000000] border-2 border-[#BFC7C9] rounded-xl shadow-sm placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all duration-300 hover:border-[#3B9797]"
                      placeholder="Digite sua senha atual"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                      <MdLock className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* New Password Fields */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-bold text-[#212121] mb-3 flex items-center gap-2">
                      <MdVpnKey className="w-4 h-4 text-[#16476A]" />
                      Nova Senha
                    </label>
                    <div className="relative group/input">
                      <input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-white text-[#000000] border-2 border-[#BFC7C9] rounded-xl shadow-sm placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all duration-300 hover:border-[#3B9797]"
                        placeholder="Mínimo 6 caracteres"
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                        <MdVpnKey className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-bold text-[#212121] mb-3 flex items-center gap-2">
                      <MdSecurity className="w-4 h-4 text-[#16476A]" />
                      Confirmar Nova Senha
                    </label>
                    <div className="relative group/input">
                      <input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-white text-[#000000] border-2 border-[#BFC7C9] rounded-xl shadow-sm placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all duration-300 hover:border-[#3B9797]"
                        placeholder="Repita a nova senha"
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                        <MdSecurity className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                {passwordError && (
                  <div className="flex items-start gap-3 p-4 bg-[#BF092F]/10 border-l-4 border-[#BF092F] rounded-xl shadow-md animate-fade-in">
                    <MdError className="w-6 h-6 text-[#BF092F] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[#BF092F] font-semibold">{passwordError}</p>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="flex items-start gap-3 p-4 bg-[#3B9797]/10 border-l-4 border-[#3B9797] rounded-xl shadow-md animate-fade-in">
                    <MdCheckCircle className="w-6 h-6 text-[#3B9797] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[#3B9797] font-semibold">{passwordSuccess}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleChangePassword}
                  disabled={passwordLoading}
                  className="group/btn w-full py-4 px-6 bg-gradient-to-r from-[#16476A] via-[#3B9797] to-[#16476A] bg-size-200 bg-pos-0 hover:bg-pos-100 text-white rounded-xl shadow-lg hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center gap-3 transition-all duration-500 font-bold text-base"
                  style={{ backgroundSize: '200% auto' }}
                >
                  {passwordLoading ? (
                    <>
                      <IoMdRefresh className="w-6 h-6 animate-spin" />
                      <span>Alterando Senha...</span>
                    </>
                  ) : (
                    <>
                      <MdVpnKey className="w-6 h-6 group-hover/btn:scale-110 transition-transform duration-300" />
                      <span>Atualizar Senha</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

