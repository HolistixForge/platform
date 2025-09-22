// Multi-language field detection utilities

export const STATUS_KEYWORDS = [
  // English
  'status',
  'progress',
  'stage',
  'phase',
  'state',
  // French
  'statut',
  'etat',
  'état',
  'progression',
  'étape',
  'phase',
  // Spanish
  'estado',
  'progreso',
  'etapa',
  'fase',
  // Italian
  'stato',
  'progresso',
  'fase',
  // German
  'zustand',
  'fortschritt',
  'phase',
  // Chinese (Simplified)
  '状态',
  '进展',
  '阶段',
  // Chinese (Traditional)
  '狀態',
  '進展',
  '階段',
  // Japanese
  'ステータス',
  '進捗',
  '段階',
  // Portuguese
  'estado',
  'progresso',
  'fase',
  // Dutch
  'status',
  'voortgang',
  'fase',
  // Russian
  'статус',
  'прогресс',
  'этап',
];

export const PRIORITY_KEYWORDS = [
  // English
  'priority',
  'importance',
  'urgency',
  'level',
  // French
  'priorité',
  'importance',
  'urgence',
  'niveau',
  // Spanish
  'prioridad',
  'importancia',
  'urgencia',
  'nivel',
  // Italian
  'priorità',
  'importanza',
  'urgenza',
  'livello',
  // German
  'priorität',
  'wichtigkeit',
  'dringlichkeit',
  'stufe',
  // Chinese (Simplified)
  '优先级',
  '重要性',
  '紧急性',
  '级别',
  // Chinese (Traditional)
  '優先級',
  '重要性',
  '緊急性',
  '級別',
  // Japanese
  '優先度',
  '重要度',
  '緊急度',
  'レベル',
  // Portuguese
  'prioridade',
  'importância',
  'urgência',
  'nível',
  // Dutch
  'prioriteit',
  'belang',
  'urgentie',
  'niveau',
  // Russian
  'приоритет',
  'важность',
  'срочность',
  'уровень',
];

export const NAME_KEYWORDS = [
  // English
  'name',
  'title',
  'subject',
  'label',
  'heading',
  'caption',
  // French
  'nom',
  'titre',
  'sujet',
  'étiquette',
  'en-tête',
  'légende',
  // Spanish
  'nombre',
  'título',
  'asunto',
  'etiqueta',
  'encabezado',
  'leyenda',
  // Italian
  'nome',
  'titolo',
  'soggetto',
  'etichetta',
  'intestazione',
  'didascalia',
  // German
  'name',
  'titel',
  'betreff',
  'etikett',
  'überschrift',
  'beschriftung',
  // Chinese (Simplified)
  '名称',
  '标题',
  '主题',
  '标签',
  '标题',
  '说明',
  // Chinese (Traditional)
  '名稱',
  '標題',
  '主題',
  '標籤',
  '標題',
  '說明',
  // Japanese
  '名前',
  'タイトル',
  '件名',
  'ラベル',
  '見出し',
  'キャプション',
  // Portuguese
  'nome',
  'título',
  'assunto',
  'rótulo',
  'cabeçalho',
  'legenda',
  // Dutch
  'naam',
  'titel',
  'onderwerp',
  'label',
  'kop',
  'bijschrift',
  // Russian
  'имя',
  'заголовок',
  'тема',
  'метка',
  'заголовок',
  'подпись',
];

/**
 * Checks if a field name contains any of the provided keywords
 */
export const containsKeywords = (
  fieldName: string,
  keywords: string[]
): boolean => {
  const lowerFieldName = fieldName.toLowerCase();
  return keywords.some((keyword) =>
    lowerFieldName.includes(keyword.toLowerCase())
  );
};

/**
 * Detects status field from a list of fields
 */
export const detectStatusField = (fields: { type: string; name: string }[]) => {
  return fields.find(
    (field) =>
      field.type === 'singleSelect' &&
      containsKeywords(field.name, STATUS_KEYWORDS)
  );
};

/**
 * Detects priority field from a list of fields
 */
export const detectPriorityField = (
  fields: { type: string; name: string }[]
) => {
  return fields.find(
    (field) =>
      field.type === 'singleSelect' &&
      containsKeywords(field.name, PRIORITY_KEYWORDS)
  );
};

/**
 * Detects name/title field from a list of fields
 */
export const detectNameField = (fields: { type: string; name: string }[]) => {
  return fields.find(
    (field) =>
      (field.type === 'singleLineText' || field.type === 'longText') &&
      containsKeywords(field.name, NAME_KEYWORDS)
  );
};

/**
 * Advanced detection using field options analysis
 * This could analyze the actual options in singleSelect fields
 * to determine if they represent status or priority values
 */
export const detectFieldByOptions = (field: {
  type: string;
  options?: {
    choices?: { name: string }[];
  };
}) => {
  if (field.type !== 'singleSelect' || !field.options?.choices) {
    return null;
  }

  const options = field.options.choices
    .map((choice: { name: string }) => choice.name.toLowerCase())
    .join(' ');

  // Status-like options
  const statusPatterns = [
    'todo',
    'doing',
    'done',
    'pending',
    'completed',
    'in progress',
    'open',
    'closed',
    'resolved',
    'active',
    'inactive',
    'à faire',
    'en cours',
    'terminé',
    'en attente',
    'complété',
    'pendiente',
    'en progreso',
    'completado',
    'abierto',
    'cerrado',
  ];

  // Priority-like options
  const priorityPatterns = [
    'low',
    'medium',
    'high',
    'critical',
    'urgent',
    'normal',
    'bas',
    'moyen',
    'élevé',
    'critique',
    'urgent',
    'bajo',
    'medio',
    'alto',
    'crítico',
    'urgente',
    'basso',
    'medio',
    'alto',
    'critico',
    'urgente',
  ];

  const isStatusField = statusPatterns.some((pattern) =>
    options.includes(pattern)
  );
  const isPriorityField = priorityPatterns.some((pattern) =>
    options.includes(pattern)
  );

  if (isStatusField) return 'status';
  if (isPriorityField) return 'priority';
  return null;
};
