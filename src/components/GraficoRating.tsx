/** Gráfico de linha do rating, partida a partida. SVG puro, sem biblioteca. */
export function GraficoRating({ pontos }: { pontos: number[] }) {
  if (pontos.length < 2)
    return <p className="text-tinta-suave">O gráfico aparece depois da primeira partida confirmada.</p>;

  const L = 600, A = 220, esq = 52, dir = 16, topo = 16, base = 28;
  const min = Math.floor((Math.min(...pontos) - 20) / 10) * 10;
  const max = Math.ceil((Math.max(...pontos) + 20) / 10) * 10;
  const x = (i: number) => esq + (i * (L - esq - dir)) / (pontos.length - 1);
  const y = (r: number) => topo + ((max - r) * (A - topo - base)) / (max - min);
  const linha = pontos.map((r, i) => `${x(i).toFixed(1)},${y(r).toFixed(1)}`).join(" ");
  const primeiro = Math.round(pontos[0]);
  const ultimo = Math.round(pontos[pontos.length - 1]);
  const meio = Math.round((min + max) / 2);

  return (
    <svg
      viewBox={`0 0 ${L} ${A}`}
      className="w-full"
      role="img"
      aria-label={`Evolução do rating em ${pontos.length - 1} partidas: começou em ${primeiro} e agora está em ${ultimo}.`}
    >
      {[max, meio, min].map((r) => (
        <g key={r}>
          <line x1={esq} x2={L - dir} y1={y(r)} y2={y(r)} stroke="var(--color-linha)" strokeWidth="1.5" strokeDasharray="4 6" />
          <text x={esq - 8} y={y(r) + 5} textAnchor="end" fontSize="14" fill="var(--color-tinta-suave)">
            {r}
          </text>
        </g>
      ))}
      <text x={esq} y={A - 6} fontSize="14" fill="var(--color-tinta-suave)">
        início
      </text>
      <text x={L - dir} y={A - 6} textAnchor="end" fontSize="14" fill="var(--color-tinta-suave)">
        agora
      </text>
      <polyline points={linha} fill="none" stroke="var(--color-roxo)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pontos.length - 1)} cy={y(pontos[pontos.length - 1])} r="7" fill="var(--color-sol)" stroke="var(--color-roxo)" strokeWidth="4" />
    </svg>
  );
}
