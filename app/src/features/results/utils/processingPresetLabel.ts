const LABELS: Record<string, string> = {
  fast: 'Rápido',
  standard: 'Padrão',
  ultra: 'Máxima qualidade',
  desconhecido: 'Não registrado',
}

export function processingPresetLabel(preset: string): string {
  return LABELS[preset] ?? preset
}
