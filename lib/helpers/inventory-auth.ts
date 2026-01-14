import { AuthPayload } from './auth';

/**
 * Verifica se o usuário tem autorização para acessar um inventário específico
 *
 * @param auth - Dados de autenticação do usuário
 * @param inventoryData - Dados do inventário (deve conter storeId e companyId)
 * @returns true se o usuário tem acesso, false caso contrário
 */
export function isAuthorizedToAccessInventory(
  auth: AuthPayload,
  inventoryData: { storeId?: string; companyId?: string }
): boolean {
  // Super admin tem acesso a tudo
  if (auth.role === 'super_admin') {
    return true;
  }

  // Usuário com lojas específicas - verificar se o inventário é de uma das suas lojas
  if (auth.storeIds && auth.storeIds.length > 0) {
    const isAuthorized = auth.storeIds.includes(inventoryData?.storeId || '');
    console.log('🔍 [Inventory Auth] Verificação por storeIds:', {
      inventoryStoreId: inventoryData?.storeId,
      userStoreIds: auth.storeIds,
      isAuthorized,
    });
    return isAuthorized;
  }

  // Usuário sem lojas específicas - verificar por companyId
  const isAuthorized = inventoryData?.companyId === auth.orgId;
  console.log('🔍 [Inventory Auth] Verificação por companyId:', {
    inventoryCompanyId: inventoryData?.companyId,
    userOrgId: auth.orgId,
    isAuthorized,
  });
  return isAuthorized;
}
