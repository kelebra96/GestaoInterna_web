/**
 * Paleta de Cores para Gráficos
 * Baseada na identidade visual da aplicação
 */

// Cores principais da marca
export const BRAND_COLORS = {
  primary: '#16476A',      // Azul escuro principal
  secondary: '#3B9797',    // Teal/Verde-azulado
  accent: '#1F53A2',       // Azul médio
  dark: '#132440',         // Azul muito escuro
};

// Paleta para gráficos de dados gerais
export const CHART_PALETTE = {
  blue: '#16476A',
  teal: '#3B9797',
  lightBlue: '#1F53A2',
  cyan: '#4DB6AC',
  navy: '#132440',
  sky: '#5C9EAD',
};

// Cores para indicadores de status/performance
export const STATUS_COLORS = {
  success: '#10B981',      // Verde esmeralda
  warning: '#F59E0B',      // Âmbar
  danger: '#EF4444',       // Vermelho
  info: '#3B82F6',         // Azul info
  neutral: '#6B7280',      // Cinza
};

// Cores para classificação ABC (Pareto)
export const ABC_COLORS = {
  A: '#16476A',            // Azul escuro - Crítico (80%)
  B: '#3B9797',            // Teal - Importante (15%)
  C: '#10B981',            // Verde - Normal (5%)
};

// Cores para níveis de risco (RFE)
export const RISK_COLORS = {
  critico: '#DC2626',      // Vermelho escuro
  alto: '#F97316',         // Laranja
  medio: '#FBBF24',        // Amarelo
  baixo: '#10B981',        // Verde
};

// Cores para composição de perdas
export const LOSS_COLORS = {
  vencimento: '#16476A',   // Azul escuro
  avaria: '#3B9797',       // Teal
  roubo: '#7C3AED',        // Roxo
  outros: '#9CA3AF',       // Cinza
};

// Cores para gráficos de estoque
export const STOCK_COLORS = {
  alto: '#10B981',         // Verde - Giro alto
  medio: '#3B9797',        // Teal - Giro médio
  baixo: '#F59E0B',        // Âmbar - Giro baixo
  critico: '#EF4444',      // Vermelho - Giro crítico
};

// Gradientes para gráficos de área
export const GRADIENTS = {
  primary: ['#16476A', '#3B9797'],
  success: ['#10B981', '#34D399'],
  warning: ['#F59E0B', '#FCD34D'],
  danger: ['#EF4444', '#FCA5A5'],
};

// Sequência de cores para gráficos com múltiplas séries
export const CHART_SEQUENCE = [
  '#16476A',  // Azul escuro
  '#3B9797',  // Teal
  '#1F53A2',  // Azul médio
  '#10B981',  // Verde
  '#F59E0B',  // Âmbar
  '#7C3AED',  // Roxo
  '#EC4899',  // Rosa
  '#14B8A6',  // Ciano
];

// Cores para gráficos de barras horizontais (top 5, rankings)
export const BAR_COLORS = {
  primary: '#16476A',
  gradient: ['#16476A', '#3B9797', '#4DB6AC', '#5C9EAD', '#7FB3C4'],
};

// Cores para tooltips e overlays
export const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E5E7EB',
  borderRadius: '12px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
};

// Estilo padrão para CartesianGrid
export const GRID_STYLE = {
  stroke: '#E5E7EB',
  strokeDasharray: '3 3',
};

// Estilo padrão para eixos
export const AXIS_STYLE = {
  stroke: '#9CA3AF',
  fontSize: 11,
  fontFamily: 'Inter, system-ui, sans-serif',
};

export default {
  BRAND_COLORS,
  CHART_PALETTE,
  STATUS_COLORS,
  ABC_COLORS,
  RISK_COLORS,
  LOSS_COLORS,
  STOCK_COLORS,
  GRADIENTS,
  CHART_SEQUENCE,
  BAR_COLORS,
  TOOLTIP_STYLE,
  GRID_STYLE,
  AXIS_STYLE,
};
