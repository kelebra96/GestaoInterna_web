import { ChecklistQuestion, QuestionAnswer, ChecklistExecution } from '../types/checklist';

/**
 * Calcula se uma resposta está conforme o esperado
 */
export function calculateAnswerConformity(
  question: ChecklistQuestion,
  answer: QuestionAnswer
): boolean {
  // Se não é verificação de conformidade, retorna true por padrão
  if (!question.isConformityCheck) {
    return true;
  }

  // Verificar conformidade baseado no tipo de pergunta
  switch (question.type) {
    case 'yes_no':
      const expectedAnswer = question.conformityExpectedAnswer || 'yes';
      return answer.value === expectedAnswer || answer.booleanValue === (expectedAnswer === 'yes');

    case 'multiple_choice':
      return answer.value === question.conformityExpectedAnswer ||
        (answer.selectedOptions?.includes(question.conformityExpectedAnswer) ?? false);

    case 'numeric':
    case 'temperature':
      const numValue = answer.numericValue || parseFloat(answer.value);
      if (isNaN(numValue)) return false;

      const hasMin = question.minValue !== undefined && question.minValue !== null;
      const hasMax = question.maxValue !== undefined && question.maxValue !== null;

      if (hasMin && numValue < question.minValue!) return false;
      if (hasMax && numValue > question.maxValue!) return false;
      return true;

    case 'text':
      return !!(answer.textValue || answer.value);

    case 'photo':
      return !!(answer.photos && answer.photos.length > 0);

    case 'signature':
      return !!answer.signature;

    default:
      return true;
  }
}

/**
 * Calcula os pontos ganhos em uma resposta
 */
export function calculateAnswerPoints(
  question: ChecklistQuestion,
  answer: QuestionAnswer
): number {
  // Se a pergunta não tem pontuação, retorna 0
  if (!question.points) {
    return 0;
  }

  // Se a resposta não foi fornecida, retorna 0
  if (!answer.value && answer.value !== false && !answer.booleanValue &&
      !answer.numericValue && !answer.textValue && !answer.selectedOptions) {
    return 0;
  }

  // Para perguntas de conformidade, só ganha pontos se estiver conforme
  if (question.isConformityCheck) {
    const isConform = calculateAnswerConformity(question, answer);
    return isConform ? question.points : 0;
  }

  // Para perguntas sem conformidade, ganha pontos se respondeu
  return question.points;
}

/**
 * Calcula a pontuação total e conformidade de uma execução
 */
export function calculateExecutionScore(
  questions: ChecklistQuestion[],
  answers: QuestionAnswer[]
): {
  score: {
    totalPoints: number;
    pointsAwarded: number;
    percentage: number;
  };
  conformity: {
    totalChecks: number;
    conformChecks: number;
    nonConformChecks: number;
    percentage: number;
  };
} {
  let totalPoints = 0;
  let pointsAwarded = 0;
  let totalConformityChecks = 0;
  let conformChecks = 0;

  questions.forEach((question) => {
    // Somar pontos totais
    if (question.points) {
      totalPoints += question.points;
    }

    // Encontrar resposta correspondente
    const answer = answers.find((a) => a.questionId === question.id);

    if (answer) {
      // Calcular pontos ganhos
      const points = calculateAnswerPoints(question, answer);
      pointsAwarded += points;

      // Calcular conformidade
      if (question.isConformityCheck) {
        totalConformityChecks++;
        const isConform = calculateAnswerConformity(question, answer);
        if (isConform) {
          conformChecks++;
        }
      }
    }
  });

  const nonConformChecks = totalConformityChecks - conformChecks;

  return {
    score: {
      totalPoints,
      pointsAwarded,
      percentage: totalPoints > 0 ? Math.round((pointsAwarded / totalPoints) * 100) : 0,
    },
    conformity: {
      totalChecks: totalConformityChecks,
      conformChecks,
      nonConformChecks,
      percentage: totalConformityChecks > 0
        ? Math.round((conformChecks / totalConformityChecks) * 100)
        : 0,
    },
  };
}

/**
 * Atualiza uma execução com score e conformidade calculados
 */
export function updateExecutionWithScore(
  execution: ChecklistExecution,
  questions: ChecklistQuestion[]
): ChecklistExecution {
  const { score, conformity } = calculateExecutionScore(questions, execution.answers);

  return {
    ...execution,
    score,
    conformity,
  };
}
