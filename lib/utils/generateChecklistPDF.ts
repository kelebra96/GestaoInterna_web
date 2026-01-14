import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ChecklistExecution {
  id: string;
  templateName: string;
  templateType: string;
  storeName: string;
  storeId: string;
  userName: string;
  status: string;
  progress: number;
  completedAt?: string;
  createdAt: string;
  answers: any[];
}

interface Stats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  completionRate: number;
  byType: Record<string, number>;
  byStore: Record<string, number>;
}

interface ReportParams {
  executions: ChecklistExecution[];
  stats: Stats;
  storeName?: string;
  periodLabel: string;
  typeFilter?: string;
}

const typeLabels: Record<string, string> = {
  opening: 'Abertura',
  closing: 'Fechamento',
  haccp: 'HACCP',
  cleaning: 'Limpeza',
  merchandising: 'Merchandising',
  maintenance: 'Manutenção',
  audit: 'Auditoria',
  custom: 'Personalizado',
};

export function generateChecklistPDF(params: ReportParams) {
  const { executions, stats, storeName, periodLabel, typeFilter } = params;

  // Criar documento PDF (A4)
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // Cores
  const primaryColor: [number, number, number] = [31, 83, 162]; // #1F53A2
  const successColor: [number, number, number] = [76, 175, 80]; // #4CAF50
  const warningColor: [number, number, number] = [255, 152, 0]; // #FF9800
  const dangerColor: [number, number, number] = [232, 33, 41]; // #E82129

  // ========================================
  // CABE�ALHO
  // ========================================
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Logo/T�tulo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('MyInventory', 15, 18);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório de Checklists', 15, 28);

  // Data de geração
  doc.setFontSize(9);
  const now = new Date();
  const dateStr = now.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Gerado em: ${dateStr}`, pageWidth - 15, 18, { align: 'right' });

  yPosition = 50;

  // ========================================
  // INFORMAÇÕES DO RELATÓRIO
  // ========================================
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Informações do Relatório', 15, yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  if (storeName && storeName !== 'all') {
    doc.text(`Loja: ${storeName}`, 15, yPosition);
    yPosition += 6;
  } else {
    doc.text('Loja: Todas as Lojas', 15, yPosition);
    yPosition += 6;
  }

  if (typeFilter && typeFilter !== 'all') {
    doc.text(`Tipo de Checklist: ${typeLabels[typeFilter] || typeFilter}`, 15, yPosition);
    yPosition += 6;
  } else {
    doc.text('Tipo de Checklist: Todos', 15, yPosition);
    yPosition += 6;
  }

  doc.text(`Período: ${periodLabel}`, 15, yPosition);
  yPosition += 10;

  // ========================================
  // RESUMO ESTATÍSTICO
  // ========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Resumo Estatístico', 15, yPosition);
  yPosition += 8;

  // Cards de estatísticas
  const cardWidth = (pageWidth - 40) / 4;
  const cardHeight = 25;
  const cardSpacing = 5;
  let xPosition = 15;

  // Total
  doc.setFillColor(31, 83, 162);
  doc.roundedRect(xPosition, yPosition, cardWidth, cardHeight, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(stats.total.toString(), xPosition + cardWidth / 2, yPosition + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL', xPosition + cardWidth / 2, yPosition + 20, { align: 'center' });

  xPosition += cardWidth + cardSpacing;

  // Concluídos
  doc.setFillColor(...successColor);
  doc.roundedRect(xPosition, yPosition, cardWidth, cardHeight, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(stats.completed.toString(), xPosition + cardWidth / 2, yPosition + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`CONCLUÍDOS (${stats.completionRate}%)`, xPosition + cardWidth / 2, yPosition + 20, { align: 'center' });

  xPosition += cardWidth + cardSpacing;

  // Em Progresso
  doc.setFillColor(...warningColor);
  doc.roundedRect(xPosition, yPosition, cardWidth, cardHeight, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(stats.inProgress.toString(), xPosition + cardWidth / 2, yPosition + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('EM PROGRESSO', xPosition + cardWidth / 2, yPosition + 20, { align: 'center' });

  xPosition += cardWidth + cardSpacing;

  // Pendentes
  doc.setFillColor(...dangerColor);
  doc.roundedRect(xPosition, yPosition, cardWidth, cardHeight, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(stats.pending.toString(), xPosition + cardWidth / 2, yPosition + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('PENDENTES', xPosition + cardWidth / 2, yPosition + 20, { align: 'center' });

  yPosition += cardHeight + 15;

  // ========================================
  // TABELA DE EXECUÇÕES
  // ========================================
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Execuções Encontradas (${executions.length})`, 15, yPosition);
  yPosition += 5;

  // Preparar dados da tabela
  const tableData = executions.map((exec) => {
    const statusLabel =
      exec.status === 'completed'
        ? 'Concluído'
        : exec.status === 'in_progress'
        ? 'Em Progresso'
        : 'Agendado';

    const date = new Date(exec.completedAt || exec.createdAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return [
      exec.templateName,
      exec.storeName,
      exec.userName,
      statusLabel,
      `${exec.progress}%`,
      date,
    ];
  });

  // Gerar tabela
  autoTable(doc, {
    startY: yPosition,
    head: [['Template', 'Loja', 'Responsável', 'Status', 'Progresso', 'Data']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [33, 33, 33],
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    columnStyles: {
      0: { cellWidth: 45 }, // Template
      1: { cellWidth: 35 }, // Loja
      2: { cellWidth: 35 }, // Responsável
      3: { cellWidth: 25 }, // Status
      4: { cellWidth: 20, halign: 'center' }, // Progresso
      5: { cellWidth: 30 }, // Data
    },
    margin: { left: 15, right: 15 },
    didDrawPage: (data) => {
      // Rodapé
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      doc.text('MyInventory - Sistema de Gestão Interna', 15, pageHeight - 10);
    },
  });

  // ========================================
  // ANÁLISE POR TIPO (se APLICÁVEL)
  // ========================================
  if (Object.keys(stats.byType).length > 1 && typeFilter === 'all') {
    doc.addPage();
    yPosition = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Análise por Tipo de Checklist', 15, yPosition);
    yPosition += 10;

    const typeTableData = Object.entries(stats.byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => [
        typeLabels[type] || type,
        count.toString(),
        `${((count / stats.total) * 100).toFixed(1)}%`,
      ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Tipo', 'Quantidade', 'Percentual']],
      body: typeTableData,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
      },
      margin: { left: 15, right: 15 },
    });
  }

  // ========================================
  // ANÁLISE POR LOJA (se APLICÁVEL)
  // ========================================
  if (Object.keys(stats.byStore).length > 1 && (!storeName || storeName === 'all')) {
    const currentY = (doc as any).lastAutoTable.finalY || yPosition;

    if (currentY > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    } else {
      yPosition = currentY + 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Análise por Loja', 15, yPosition);
    yPosition += 10;

    const storeTableData = Object.entries(stats.byStore)
      .sort((a, b) => b[1] - a[1])
      .map(([store, count]) => [
        store,
        count.toString(),
        `${((count / stats.total) * 100).toFixed(1)}%`,
      ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Loja', 'Quantidade', 'Percentual']],
      body: storeTableData,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
      },
      margin: { left: 15, right: 15 },
    });
  }

  // ========================================
  // SALVAR PDF
  // ========================================
  const fileName = `relatorio-checklists-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.pdf`;
  doc.save(fileName);
}
