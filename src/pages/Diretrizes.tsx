import { MessageSquare } from "lucide-react";

const ACCENT = "#d7d900";
const BLUE = "#2659a5";

function MacroOKRHeader({ title, objetivo }: { title: string; objetivo: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ background: "#1a3260", color: "#fff", padding: "10px 16px", borderRadius: "8px 8px 0 0", fontWeight: 700, fontSize: 14 }}>
        MacroOKR: {title}
      </div>
      <div style={{ background: ACCENT, color: "#1a1a1a", padding: "8px 16px", borderRadius: "0 0 0 0", fontSize: 13 }}>
        <strong>Objetivo:</strong> {objetivo}
      </div>
    </div>
  );
}

function KRTable({ krs }: { krs: any[] }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 32 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: BLUE, color: "#fff" }}>
            <th style={{ padding: "8px 12px", textAlign: "center", width: 40, border: "1px solid #c8d8f0" }}>#</th>
            <th style={{ padding: "8px 12px", textAlign: "left", width: 140, border: "1px solid #c8d8f0" }}>Áreas Aplicáveis</th>
            <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #c8d8f0" }}>KR Obrigatório / Direcionamento</th>
            <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #c8d8f0" }}>Contexto: fala original C-levels</th>
            <th style={{ padding: "8px 12px", textAlign: "center", width: 100, border: "1px solid #c8d8f0" }}>Capitão</th>
            <th style={{ padding: "8px 12px", textAlign: "center", width: 100, border: "1px solid #c8d8f0" }}>Grade 0</th>
            <th style={{ padding: "8px 12px", textAlign: "center", width: 100, border: "1px solid #c8d8f0" }}>Grade 1</th>
          </tr>
        </thead>
        <tbody>
          {krs.map((kr, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#f8faff" : "#fff" }}>
              <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: BLUE, border: "1px solid #e2eaf5" }}>{kr.id}</td>
              <td style={{ padding: "10px 12px", border: "1px solid #e2eaf5", fontSize: 12 }}>
                {kr.areas?.includes("@todas") ? (
                  <span>
                    <span style={{ color: BLUE, fontWeight: 600 }}>@todas as áreas</span>
                    <br />
                    <span style={{ color: "#e5381a", fontSize: 11, fontWeight: 600 }}>[Estes KRs devem ser obrigatoriamente incorporados aos OKRs das áreas]</span>
                  </span>
                ) : kr.areas}
              </td>
              <td style={{ padding: "10px 12px", border: "1px solid #e2eaf5", lineHeight: 1.5 }}>{kr.kr}</td>
              <td style={{ padding: "10px 12px", border: "1px solid #e2eaf5", color: "#555", fontStyle: "italic", fontSize: 12, lineHeight: 1.5 }}>
                {kr.contexto && <><MessageSquare size={12} style={{ display: "inline", marginRight: 4, color: BLUE }} />{kr.contexto}</>}
              </td>
              <td style={{ padding: "10px 12px", textAlign: "center", border: "1px solid #e2eaf5", fontWeight: 500 }}>{kr.capitao}</td>
              <td style={{ padding: "10px 12px", textAlign: "center", border: "1px solid #e2eaf5", color: "#666", fontSize: 12 }}>{kr.grade0}</td>
              <td style={{ padding: "10px 12px", textAlign: "center", border: "1px solid #e2eaf5", color: "#333", fontWeight: 600, fontSize: 12 }}>{kr.grade1}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const macroIA = {
  title: "IA como motor de produtividade e decisão · Uma empresa IA-First",
  objetivo: "Transformar a IA em uma alavanca estratégica de produtividade e geração de valor para o negócio",
  krs: [
    {
      id: "D1", areas: "@todas as áreas",
      kr: "Gerar R$Y/semestre por meio da adoção de IA nos processos da área, com impacto comprovado em projetos submetidos e validados no link oficial.\nProposta: 100k/semestre por área.",
      contexto: '"Ter um time de fato que desenvolve agentes inteligentes e reduzir drasticamente a quantidade de trabalho manual feito."',
      capitao: "Bruno Bluhm", grade0: "R$ (Y/3)/semestre por área", grade1: "R$Y/semestre por área"
    },
    {
      id: "D2", areas: "@todas as áreas",
      kr: "Garantir que X% do time alcance score ≥ 31 (amarelo ou verde) no Gomoon até dez/26 e que a área implemente no mínimo Y iniciativas de IA submetidos e validados no link oficial.",
      contexto: '"Garantir pelo menos X% do time com nota amarela e Y% verde em IA na dashboard. Foco em garantir que só vai ter lugar na empresa quem estiver gerando valor com IA, com poucas exceções."',
      capitao: "Bruno Bluhm",
      grade0: "Gomoon · peso 0,25 ≥ X/3 → 0 pts\nProjetos RPA · peso 0,25 ≥ Y/3 → 0 pts",
      grade1: "Gomoon · peso 0,5 ≥ X → 0,5 pts\nProjetos RPA · peso 0,5 ≥ Y → 0,5 pts"
    },
  ]
};

const macroPessoas = {
  title: "Excelência em Pessoas: formar times de alta performance por meio de barra alta, responsabilidade e decisões rápidas",
  objetivo: "Construir times de alta performance por meio de avaliações consistentes, transparência sobre os problemas, responsabilidade da liderança e rapidez na tomada de decisão.",
  krs: [
    {
      id: "D3", areas: "Gente & Gestão e Lideranças\n(mindset vale para todos os líderes)",
      kr: "Garantir 100% de participação do time elegível no ciclo de avaliação 2026.2.",
      contexto: '"Barra alta na avaliação de performance. Empresa de R$2bi nessa velocidade não aguenta baixa performance em setores. Não estamos aqui pra isso. Foco em garantir que só vai ter lugar na empresa quem estiver gerando valor com IA, com poucas exceções. Se não fizermos isso, além de andar mais devagar, corremos o risco de perder os melhores."',
      capitao: "Simony", grade0: "50,00%", grade1: "100,00%"
    },
    {
      id: "D4", areas: "Gente & Gestão e Lideranças",
      kr: "Concluir a tratativa de 100% dos casos de baixa performance identificados no ciclo 2026.2, com avaliação registrada, decisão formalizada e ação gerencial executada até dez/26, considerando aspectos de cultura, performance e geração de valor por meio de IA.",
      contexto: "",
      capitao: "Simony", grade0: "30% dos casos", grade1: "100% dos casos"
    },
  ]
};

const macroCX = {
  title: "Experiência do Cliente como Pilar do Gogroup",
  objetivo: "Foco no NPS do cliente como uma premissa importante para todos os canais.",
  krs: [
    {
      id: "D5", areas: "B2B Gobeaute",
      kr: "Implantar o Squad de CX B2B, com monitoramento contínuo da jornada e resolução das principais dores dos clientes, alcançando NPS mensal de B2B ≥ X.",
      contexto: '"Resolver B2B. Implantar Squad (funcional). Levantar dores e buscar ferramentas. Com base nas dores buscar alternativas de mercado." — Luis',
      capitao: "Joaquim", grade0: "Squad Implementado", grade1: "NPS mensal de B2B ≥ X"
    },
    {
      id: "D6", areas: "B2B Gobeaute",
      kr: "Garantir SLA de entrega mensal de B2B ≥ X%, assegurando previsibilidade e cumprimento dos prazos acordados com os clientes.",
      contexto: '"Resolver B2B. Implantar Squad (funcional). Levantar dores e buscar ferramentas. Com base nas dores buscar alternativas de mercado." — Luis',
      capitao: "Rafael Menezes", grade0: "A definir pela área", grade1: "SLA B2B ≥ X%"
    },
    {
      id: "D7", areas: "CX · Operações · Transportes · Qualidade · Produto · Supply · Sourcing",
      kr: "Reduzir em X% o custo de reembolsos e reenvios vs. 26.1, com 100% dos casos classificados por causa raiz e responsável definido.",
      contexto: '"Implantação do novo fluxo de devolução em todos os nossos CDs (B2B/B2C/Mktplace). Ajuste dos processos criados pela qualidade. Conscientização da empresa do impacto desse novo fluxo em todas as áreas. Reduzir desperdícios no processo de reembolso / reenvio. Segmentar processo por causa. Garantir cobrança dos responsáveis na cadeia de suprimentos."',
      capitao: "Rafael Menezes", grade0: "A definir pela área", grade1: "A definir pela área"
    },
  ]
};

const macroEspinha = {
  title: "Construir a espinha dorsal do GoGroup para suportar a escala de 2027, com sistemas, processos integrados e times preparados para crescimento",
  objetivo: "Estruturar a base operacional e organizacional do GoGroup para viabilizar a escala de 2027, garantindo integração entre áreas críticas, evolução de sistemas e preparação dos times para crescimento e novas aquisições.",
  krs: [
    {
      id: "D8", areas: "Gente e Gestão",
      kr: "Ter 100% das posições críticas mapeadas, aprovadas e preenchidas para a estrutura organizacional de 2027 até dez/26.",
      contexto: "Criar uma estrutura escalável para 2027",
      capitao: "Simony", grade0: "50% dos casos", grade1: "100% dos casos"
    },
    {
      id: "D9", areas: "Operações · Transportes",
      kr: "Concluir, em 2026, os KRs estruturantes de Operações e Transportes que construam a base necessária para sustentar o crescimento e a escalabilidade da Gobeaute em 2027.",
      contexto: '"Desenho estrutura 2027: Compras/planejamento de insumos, Mkt Gobeauty, Gaps comercial B2B, Time integração áreas estratégicas, Completar time produto." — Luis\n"Plano operação e Logística 2027 Gobeaute B2C e B2B."',
      capitao: "Rafael Menezes", grade0: "0", grade1: "1"
    },
    {
      id: "D10", areas: "@todas as áreas",
      kr: "Concluir até dez/26 a estruturação das frentes críticas para 2027, incluindo Compras e Planejamento de Insumos, Marketing de Influência, Marketing Gobeaute, B2B, Integrações, Produto.",
      contexto: '"Desenho estrutura 2027: Compras/planejamento de insumos, Mkt Gobeauty, Gaps comercial B2B, Time integração áreas estratégicas, Completar time produto." — Luis\nOperação BLACK / NATAL: 1. Gobeaute, 2. Unilog, 3. Tiktokshop dentro de operações, 4. JULHO TER CLAREZA',
      capitao: "Guilher Nóbrega", grade0: "0", grade1: "1"
    },
    {
      id: "D11", areas: "Marketing de Influência e Growth",
      kr: "Desenvolver uma estrutura escalável de Marketing de Influência e Growth capaz de integrar novas aquisições com rapidez e eficiência.",
      contexto: "",
      capitao: "André Castro", grade0: "0", grade1: "1"
    },
    {
      id: "D12", areas: "@todas as áreas",
      kr: "Operar 100% das marcas e canais de distribuição exclusivamente nas Hubs do grupo (CNPJs do FIPE) até dez/26.",
      contexto: '"Todas as marcas (sem exceção) dentro dos CNPJs do FIPE. Todas os canais de distribuição (sem exceção) dentro dos CNPJs do FIPE. OBS: Mktplace e Apice ainda não estão."',
      capitao: "Vinicius Nishide", grade0: "50% migrados", grade1: "100% migrados"
    },
  ]
};

const mindsets = [
  {
    titulo: "IA não é opcional",
    texto: "O uso de IA é uma expectativa para todos no Gogroup. Para os líderes, essa expectativa vai além do uso individual — esperamos que cada gestor eleve o patamar da sua área através de IA, reduzindo trabalho manual, desenvolvendo novas formas de executar processos e criando um time cada vez mais produtivo. Cada líder é responsável por identificar onde o trabalho manual ainda existe e agir sobre isso. A empresa que continuar fazendo o que uma máquina pode fazer vai andar mais devagar que a concorrência — e não há espaço no grupo para quem não estiver gerando valor com IA. A capacidade de transformar IA em ganhos reais de eficiência e resultado será considerada na avaliação de desempenho da liderança."
  },
  {
    titulo: "Olhar honesto para o time",
    texto: "Uma empresa que cresce na velocidade do Gogroup não aguenta conviver com baixa performance em posições-chave. O papel do líder não é proteger o time de conversas difíceis — é ter essas conversas cedo, com clareza e respeito. Todo gap de performance identificado precisa de um próximo passo definido. Deixar o problema em aberto não é gentileza — é negligência com o time inteiro."
  },
  {
    titulo: "Problemas aparecem, não somem",
    texto: "O Gogroup não precisa de líderes que administram aparências — precisa de líderes que trazem os problemas à superfície antes que virem crise. Tocar de lado, delegar de volta para cima ou aguardar que o problema se resolva sozinho são comportamentos que travam o grupo. Senso de dono significa: o problema entrou na minha área, e eu sou responsável pelo próximo passo."
  }
];

export default function Diretrizes() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: BLUE, marginBottom: 4 }}>
          Diretrizes para construção dos OKRs 2026.2
        </h1>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          MacroOKRs obrigatórios e direcionamentos estratégicos para o segundo semestre de 2026.
        </p>
      </div>

      {/* MacroOKR 1: IA */}
      <MacroOKRHeader title={macroIA.title} objetivo={macroIA.objetivo} />
      <KRTable krs={macroIA.krs} />

      {/* MacroOKR 2: Pessoas */}
      <MacroOKRHeader title={macroPessoas.title} objetivo={macroPessoas.objetivo} />
      <KRTable krs={macroPessoas.krs} />

      {/* MacroOKR 3: CX */}
      <MacroOKRHeader title={macroCX.title} objetivo={macroCX.objetivo} />
      <KRTable krs={macroCX.krs} />

      {/* MacroOKR 4: Espinha dorsal */}
      <MacroOKRHeader title={macroEspinha.title} objetivo={macroEspinha.objetivo} />
      <KRTable krs={macroEspinha.krs} />

      {/* Mindsets */}
      <div style={{ marginTop: 16, marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: BLUE, marginBottom: 16, borderBottom: `3px solid ${ACCENT}`, paddingBottom: 8 }}>
          Mindsets importantes para os líderes
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mindsets.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 16, padding: "16px 20px", background: "#f8faff", borderRadius: 8, borderLeft: `4px solid ${BLUE}` }}>
              <div style={{ minWidth: 180, fontWeight: 700, color: BLUE, fontSize: 14, paddingTop: 2 }}>{m.titulo}</div>
              <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.7 }}>"{m.texto}"</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
