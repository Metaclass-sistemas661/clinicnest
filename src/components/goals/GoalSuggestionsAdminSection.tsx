// Componente desativado - tabela goal_suggestions não existe
// TODO: Criar tabela goal_suggestions no banco de dados para ativar este componente

interface Profile {
  id: string;
  full_name: string;
}

interface GoalSuggestionsAdminSectionProps {
  tenantId: string;
  professionals: Profile[];
  onApprovedOrRejected: () => void;
}

export function GoalSuggestionsAdminSection(_props: GoalSuggestionsAdminSectionProps) {
  return null;
}
