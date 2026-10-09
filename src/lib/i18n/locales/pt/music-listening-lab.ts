const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "Perfis de audição",
  "music.lab.profilesHelp":
    "Guarde uma correção para cada par de auscultadores ou colunas. Carregar altera o rascunho; mantém a saída e o limite de volume. Aplique para ouvir.",
  "music.lab.profileName": "Nome do perfil",
  "music.lab.saveProfile": "Guardar rascunho como perfil",
  "music.lab.selectProfile": "Selecionar perfil",
  "music.lab.loadProfile": "Carregar no rascunho",
  "music.lab.delete": "Eliminar",
  "music.lab.response": "Resposta calculada do equalizador",
  "music.lab.curveHelp":
    "Resposta EQ a {rate} kHz, antes do pré-amplificador. Contínua: rascunho. Tracejada: definições aplicadas. É um cálculo, não uma medição do dispositivo.",
  "music.lab.strength": "Intensidade da correção",
  "music.lab.strengthHelp":
    "Ajusta os ganhos de pico e prateleira. Filtros passa e rejeita mantêm a forma; 0% ignora todos os filtros paramétricos.",
  "music.lab.filter": "Filtro",
  "music.lab.enabled": "Ativo",
  "music.lab.peak": "Pico",
  "music.lab.lowShelf": "Prateleira baixa",
  "music.lab.highShelf": "Prateleira alta",
  "music.lab.lowPass": "Passa-baixo",
  "music.lab.highPass": "Passa-alto",
  "music.lab.notch": "Rejeita-banda",
  "music.lab.addFilter": "Adicionar filtro",
  "music.lab.headroomHelp":
    "Margem automática: {db} dB. Estima os picos combinados com reserva de 0,5 dB. Pré-amplificação positiva pode consumir a reserva.",
  "music.lab.importExport": "Importar / exportar correção",
  "music.lab.importHelp":
    "Cole filtros Equalizer APO / AutoEQ. Aceita PK, LSC, HSC, LP, HP e NO com Q. Importar usa o pré-amplificador do ficheiro e desativa a margem automática. Exportar inclui intensidade e margem no texto abaixo.",
  "music.lab.correctionText": "Texto de correção",
  "music.lab.import": "Importar para rascunho",
  "music.lab.export": "Gerar texto de exportação",
  "music.lab.importError":
    "Correção inválida ou incompatível. Use 1–24 filtros, 20–20.000 Hz, ±18 dB e Q 0,1–12. Outros comandos não são suportados.",
  "music.lab.preamp": "Pré-amplificador · dB",
  "music.lab.crossfeed": "Crossfeed para auscultadores",
  "music.lab.crossfeedHelp":
    "Mistura parte filtrada de cada canal estéreo no outro para reduzir a separação nos auscultadores. 0% desativa.",
  "music.lab.bypass": "Ignorar DSP do Harbor",
  "music.lab.bypassHelp":
    "Após aplicar, ignora EQ, pré-amplificador, crossfeed, balanço e ReplayGain. Saída e volume mantêm-se ativos. Não verifica reprodução bit-perfect.",
  "music.lab.exclusive": "Pedir saída exclusiva",
  "music.lab.exclusiveHelp":
    "Saídas compatíveis podem evitar o misturador do sistema e bloquear outras aplicações. Depende do controlador; esta opção pede acesso, não o confirma.",
  "music.lab.sampleRate": "Taxa de amostragem de saída",
  "music.lab.sourceRate": "Seguir fonte",
  "music.lab.rateHelp":
    "Não pede taxa fixa. O dispositivo pode negociar outra. Uma taxa fixa reamostra quando necessário; não recupera detalhes perdidos na compressão.",
  "music.lab.equalizer": "Equalizador",
  "music.lab.mode": "Modo do equalizador",
  "music.lab.parametric": "Paramétrico · até 24 filtros",
};
export default musicListeningLab;
