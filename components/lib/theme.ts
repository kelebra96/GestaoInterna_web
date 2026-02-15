/**
 * Paleta de Cores do MyInventory
 * Sincronizada com a aplicação mobile
 */

export const colors = {
  // Cores principais
  primary: '#1F53A2',      // Azul escuro
  primaryLight: '#E3EFFF', // Azul muito claro (para backgrounds)
  primaryDark: '#153D7A',  // Azul mais escuro
  secondary: '#5C94CC',    // Azul claro
  accent: '#E82129',       // Vermelho

  // Cores de suporte
  tertiary: '#647CAC',     // Azul médio
  neutral: '#BFC7C9',      // Cinza claro

  // Estados
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#E82129',
  info: '#5C94CC',

  // Backgrounds
  background: '#FFFFFF',
  surface: '#F5F5F5',
  card: '#FFFFFF',

  // Text
  text: '#212121',
  textPrimary: '#212121',
  textSecondary: '#757575',
  textLight: '#FFFFFF',

  // Borders
  border: '#BFC7C9',
  divider: '#E0E0E0',

  // Transparent
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export type ColorPalette = typeof colors;
