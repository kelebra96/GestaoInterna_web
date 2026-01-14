/**
 * Gerador de arquivo TXT com layout posicional fixo
 * MyInventory - Sistema de Gestão de Inventário
 */

import { ExportItem } from '@/lib/types/inventory';

/**
 * Layout do arquivo TXT (posições 1-based):
 * - Posições 1-13:   EAN (13 dígitos)
 * - Posição 14:      Espaço
 * - Posições 15-24:  Código Interno (10 caracteres)
 * - Posições 25-74:  Descrição (50 caracteres)
 * - Posição 75:      Espaço
 * - Posições 76-83:  Preço (8 caracteres)
 * - Posições 84-92:  Quantidade (9 caracteres) - QUANTIDADE CONTADA
 */

/**
 * Preenche uma string com espaços à direita até o tamanho especificado
 * @param str String original
 * @param length Tamanho desejado
 * @returns String preenchida
 */
function padRight(str: string, length: number): string {
  return str.substring(0, length).padEnd(length, ' ');
}

/**
 * Preenche uma string numérica com zeros à esquerda até o tamanho especificado
 * @param num Número
 * @param length Tamanho desejado
 * @returns String preenchida
 */
function padLeft(num: number | string, length: number): string {
  return String(num).padStart(length, '0');
}

/**
 * Formata preço em centavos para o formato do arquivo TXT
 * @param priceInCents Preço em centavos
 * @returns String formatada (8 caracteres)
 */
function formatPrice(priceInCents: number): string {
  // Converter centavos para reais (dividir por 100)
  const priceInReais = priceInCents / 100;

  // Formatar com 2 casas decimais
  const formatted = priceInReais.toFixed(2);

  // Preencher com zeros à esquerda até 8 caracteres
  return padLeft(formatted, 8);
}

/**
 * Formata uma linha do arquivo TXT no formato posicional
 * @param item Item a ser exportado
 * @returns Linha formatada (92 caracteres)
 */
export function formatTxtLine(item: ExportItem): string {
  // EAN (13 dígitos) - posições 1-13
  const ean = padRight(item.ean, 13);

  // Espaço - posição 14
  const space1 = ' ';

  // Código Interno (10 caracteres) - posições 15-24
  const internalCode = padRight(item.internalCode, 10);

  // Descrição (50 caracteres) - posições 25-74
  const description = padRight(item.description, 50);

  // Espaço - posição 75
  const space2 = ' ';

  // Preço (8 caracteres) - posições 76-83
  const price = formatPrice(item.price);

  // Quantidade (9 caracteres) - posições 84-92
  const quantity = padLeft(item.quantity, 9);

  // Concatenar todos os campos
  return ean + space1 + internalCode + description + space2 + price + quantity;
}

/**
 * Gera o conteúdo completo do arquivo TXT
 * @param items Lista de itens a exportar
 * @returns Conteúdo do arquivo TXT (uma linha por item)
 */
export function generateTxtFile(items: ExportItem[]): string {
  const lines = items.map(item => formatTxtLine(item));
  return lines.join('\n');
}

/**
 * Gera o conteúdo do arquivo TXT e retorna como Blob para download
 * @param items Lista de itens a exportar
 * @param filename Nome do arquivo
 * @returns Blob para download
 */
export function generateTxtBlob(items: ExportItem[], filename: string = 'inventario.txt'): Blob {
  const content = generateTxtFile(items);
  return new Blob([content], { type: 'text/plain;charset=utf-8' });
}

/**
 * Valida se um item está pronto para exportação
 * @param item Item a validar
 * @returns true se válido, false caso contrário
 */
export function validateExportItem(item: ExportItem): boolean {
  // EAN deve ter 13 dígitos
  if (!item.ean || item.ean.length !== 13) {
    return false;
  }

  // Código interno não pode estar vazio
  if (!item.internalCode || item.internalCode.trim().length === 0) {
    return false;
  }

  // Descrição não pode estar vazia
  if (!item.description || item.description.trim().length === 0) {
    return false;
  }

  // Preço deve ser >= 0
  if (item.price < 0) {
    return false;
  }

  // Quantidade deve ser >= 0
  if (item.quantity < 0) {
    return false;
  }

  return true;
}

/**
 * Filtra e valida itens antes da exportação
 * @param items Lista de itens
 * @returns Objeto com itens válidos e inválidos
 */
export function validateExportItems(items: ExportItem[]): {
  valid: ExportItem[];
  invalid: Array<{ item: ExportItem; reason: string }>;
} {
  const valid: ExportItem[] = [];
  const invalid: Array<{ item: ExportItem; reason: string }> = [];

  for (const item of items) {
    if (validateExportItem(item)) {
      valid.push(item);
    } else {
      let reason = 'Item inválido';

      if (!item.ean || item.ean.length !== 13) {
        reason = 'EAN inválido (deve ter 13 dígitos)';
      } else if (!item.internalCode || item.internalCode.trim().length === 0) {
        reason = 'Código interno vazio';
      } else if (!item.description || item.description.trim().length === 0) {
        reason = 'Descrição vazia';
      } else if (item.price < 0) {
        reason = 'Preço negativo';
      } else if (item.quantity < 0) {
        reason = 'Quantidade negativa';
      }

      invalid.push({ item, reason });
    }
  }

  return { valid, invalid };
}

/**
 * Gera estatísticas do arquivo de exportação
 * @param items Lista de itens
 * @returns Estatísticas
 */
export function getExportStats(items: ExportItem[]): {
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  averagePrice: number;
} {
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const averagePrice = totalItems > 0 ? totalValue / totalQuantity : 0;

  return {
    totalItems,
    totalQuantity,
    totalValue, // Em centavos
    averagePrice, // Em centavos
  };
}
