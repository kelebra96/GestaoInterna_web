/**
 * Parser de arquivo TXT com layout posicional fixo
 * MyInventory - Sistema de Gestão de Inventário
 */

import { TxtLineData, TxtParseResult, TxtParseError, TxtLineSchema } from '@/lib/types/inventory';

/**
 * Layout do arquivo TXT (posições 1-based):
 * - Posições 1-13:   EAN (13 dígitos)
 * - Posição 14:      Espaço (ignorar)
 * - Posições 15-23:  Código Interno (9 caracteres)
 * - Posição 24:      Espaço (ignorar)
 * - Posições 25-74:  Descrição (50 caracteres)
 * - Posição 75:      Espaço (ignorar)
 * - Posições 76-84:  Preço (9 caracteres, formato: 000010,99) — layout novo (alguns arquivos antigos usam 8)
 * - Posições 85-92:  Quantidade/Estoque (8 dígitos)
 * Total: 92 caracteres por linha (aceita 91 no layout antigo)
 */

// Constantes para as posições (convertidas para 0-indexed)
const POSITIONS = {
  EAN_START: 0,
  EAN_END: 13,             // 13 caracteres (0-12)
  INTERNAL_CODE_START: 14,
  INTERNAL_CODE_END: 23,   // 9 caracteres (14-22)
  DESCRIPTION_START: 24,   // pula o espaço na posição 23
  DESCRIPTION_END: 74,     // 50 caracteres (24-73)
  PRICE_START: 75,         // pula o espaço na posição 74, começa em 75 (posição 76 em 1-based)
  PRICE_END_SHORT: 83,     // 8 caracteres (75-82) — layout antigo
  PRICE_END_LONG: 84,      // 9 caracteres (75-83) — layout atual
  QUANTITY_START_SHORT: 83, // começa em 83 (posição 84 em 1-based) — layout antigo
  QUANTITY_START_LONG: 84,  // começa em 84 (posição 85 em 1-based) — layout atual
  QUANTITY_END_SHORT: 91,   // 8 caracteres (83-90)
  QUANTITY_END_LONG: 92,    // 8 caracteres (84-91)
};

// Tamanho mínimo esperado da linha
const MIN_LINE_LENGTH = 91;

/**
 * Parse uma linha do arquivo TXT
 * @param line Linha do arquivo
 * @param lineNumber Número da linha (para rastreamento de erros)
 * @returns Dados parseados ou null se inválido
 */
export function parseTxtLine(line: string, lineNumber: number): TxtLineData | null {
  // Validar tamanho mínimo
  if (line.length < MIN_LINE_LENGTH) {
    return null;
  }

  try {
    const isLongLayout = line.length >= 92;
    const priceEnd = isLongLayout ? POSITIONS.PRICE_END_LONG : POSITIONS.PRICE_END_SHORT;
    const quantityStart = isLongLayout ? POSITIONS.QUANTITY_START_LONG : POSITIONS.QUANTITY_START_SHORT;
    const quantityEnd = isLongLayout ? POSITIONS.QUANTITY_END_LONG : POSITIONS.QUANTITY_END_SHORT;

    // Extrair campos usando substring (0-indexed)
    const ean = line.substring(POSITIONS.EAN_START, POSITIONS.EAN_END).trim();
    const internalCode = line.substring(POSITIONS.INTERNAL_CODE_START, POSITIONS.INTERNAL_CODE_END).trim();
    const description = line.substring(POSITIONS.DESCRIPTION_START, POSITIONS.DESCRIPTION_END).trim();
    const priceStr = line.substring(POSITIONS.PRICE_START, priceEnd).trim();
    const quantityStr = line.substring(quantityStart, quantityEnd).trim();

    // Converter preço e quantidade
    // Preço vem com vírgula (ex: "000010,99"), converter para centavos
    const priceFloat = parseFloat(priceStr.replace(',', '.'));
    const price = Math.round(priceFloat * 100); // Converter para centavos

    // Quantidade em dígitos simples
    const expectedQuantity = parseInt(quantityStr, 10);

    // Validar valores numéricos
    if (isNaN(price) || isNaN(expectedQuantity)) {
      return null;
    }

    // Criar objeto de dados
    const data: TxtLineData = {
      ean,
      internalCode,
      description,
      price,
      expectedQuantity,
      lineNumber,
      rawLine: line,
    };

    // Validar com schema Zod
    const validation = TxtLineSchema.safeParse(data);
    if (!validation.success) {
      return null;
    }

    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Parse um arquivo TXT completo
 * @param content Conteúdo do arquivo
 * @returns Resultado do parsing com linhas válidas e erros
 */
export function parseTxtFile(content: string): TxtParseResult {
  const lines: TxtLineData[] = [];
  const errors: TxtParseError[] = [];

  // Dividir por linhas (suporta \n e \r\n)
  const rawLines = content.split(/\r?\n/);
  let lineNumber = 0;

  for (const rawLine of rawLines) {
    lineNumber++;

    // Pular linhas vazias
    if (rawLine.trim().length === 0) {
      continue;
    }

    // Tentar parsear a linha
    const parsedLine = parseTxtLine(rawLine, lineNumber);

    if (parsedLine) {
      lines.push(parsedLine);
    } else {
      errors.push({
        lineNumber,
        error: rawLine.length < MIN_LINE_LENGTH
          ? `Linha muito curta (mínimo ${MIN_LINE_LENGTH} caracteres, encontrado ${rawLine.length})`
          : 'Formato inválido ou dados incorretos',
        rawLine,
      });
    }
  }

  return {
    success: errors.length === 0,
    lines,
    errors,
    totalLines: lineNumber,
    validLines: lines.length,
  };
}

/**
 * Valida se o conteúdo TXT tem formato válido antes de processar
 * @param content Conteúdo do arquivo
 * @returns true se válido, false caso contrário
 */
export function validateTxtFormat(content: string): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }

  // Deve ter pelo menos uma linha válida
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    return false;
  }

  // Pelo menos a primeira linha deve ter o tamanho mínimo
  return lines[0].length >= MIN_LINE_LENGTH;
}

/**
 * Formata erros de parsing para exibição ao usuário
 * @param errors Lista de erros
 * @param maxErrors Número máximo de erros a retornar
 * @returns String formatada com os erros
 */
export function formatParseErrors(errors: TxtParseError[], maxErrors: number = 10): string {
  const errorsToShow = errors.slice(0, maxErrors);
  const remaining = errors.length - maxErrors;

  let message = 'Erros encontrados no arquivo:\n\n';

  for (const error of errorsToShow) {
    message += `Linha ${error.lineNumber}: ${error.error}\n`;
    message += `  Conteúdo: ${error.rawLine.substring(0, 50)}...\n\n`;
  }

  if (remaining > 0) {
    message += `\n... e mais ${remaining} erro(s).`;
  }

  return message;
}

/**
 * Extrai preview das primeiras linhas parseadas
 * @param parseResult Resultado do parsing
 * @param maxLines Número máximo de linhas no preview
 * @returns Array com as primeiras linhas parseadas
 */
export function getPreviewLines(parseResult: TxtParseResult, maxLines: number = 20): TxtLineData[] {
  return parseResult.lines.slice(0, maxLines);
}
