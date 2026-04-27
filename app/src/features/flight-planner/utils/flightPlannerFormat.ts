/** Números com vírgula decimal (pt-BR) para o painel de planejamento. */
export const flightPlannerFormat = {
  number: (value: number, digits = 1) =>
    value.toFixed(digits).replace(".", ","),
};
