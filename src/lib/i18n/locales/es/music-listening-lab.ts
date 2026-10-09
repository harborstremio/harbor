const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "Perfiles de escucha",
  "music.lab.profilesHelp":
    "Guarda una corrección para cada auricular o altavoz. Cargar modifica el borrador; mantiene la salida y el límite de volumen. Aplica para escuchar.",
  "music.lab.profileName": "Nombre del perfil",
  "music.lab.saveProfile": "Guardar borrador como perfil",
  "music.lab.selectProfile": "Seleccionar perfil",
  "music.lab.loadProfile": "Cargar en borrador",
  "music.lab.delete": "Eliminar",
  "music.lab.response": "Respuesta calculada del ecualizador",
  "music.lab.curveHelp":
    "Respuesta EQ a {rate} kHz, antes del preamplificador. Continua: borrador. Discontinua: ajustes aplicados. Es un cálculo, no una medición del dispositivo.",
  "music.lab.strength": "Intensidad de corrección",
  "music.lab.strengthHelp":
    "Escala la ganancia de pico y estantería. Los filtros de paso y rechazo mantienen su forma; 0 % omite todos los filtros paramétricos.",
  "music.lab.filter": "Filtro",
  "music.lab.enabled": "Activo",
  "music.lab.peak": "Pico",
  "music.lab.lowShelf": "Estantería baja",
  "music.lab.highShelf": "Estantería alta",
  "music.lab.lowPass": "Paso bajo",
  "music.lab.highPass": "Paso alto",
  "music.lab.notch": "Rechazo de banda",
  "music.lab.addFilter": "Añadir filtro",
  "music.lab.headroomHelp":
    "Margen automático: {db} dB. Estima los picos combinados con 0,5 dB de reserva. La preamplificación positiva puede consumir esa reserva.",
  "music.lab.importExport": "Importar / exportar corrección",
  "music.lab.importHelp":
    "Pega texto de filtros Equalizer APO / AutoEQ. Admite PK, LSC, HSC, LP, HP y NO con Q. Importar usa el preamplificador del archivo y desactiva el margen automático. Exportar incluye intensidad y margen en el texto inferior.",
  "music.lab.correctionText": "Texto de corrección",
  "music.lab.import": "Importar al borrador",
  "music.lab.export": "Generar texto de exportación",
  "music.lab.importError":
    "Corrección no válida o incompatible. Usa 1–24 filtros, 20–20.000 Hz, ±18 dB y Q 0,1–12. No se admiten otras órdenes de procesamiento.",
  "music.lab.preamp": "Preamplificador · dB",
  "music.lab.crossfeed": "Crossfeed para auriculares",
  "music.lab.crossfeedHelp":
    "Mezcla una parte filtrada de cada canal estéreo en el otro para reducir la separación en auriculares. 0 % lo desactiva.",
  "music.lab.bypass": "Omitir DSP de Harbor",
  "music.lab.bypassHelp":
    "Tras aplicar, omite EQ, preamplificador, crossfeed, balance y ReplayGain. La salida y el volumen siguen activos. No verifica reproducción bit-perfect.",
  "music.lab.exclusive": "Solicitar salida exclusiva",
  "music.lab.exclusiveHelp":
    "Las salidas compatibles pueden evitar el mezclador del sistema y bloquear otras apps. Depende del controlador; esta opción solicita acceso, no lo confirma.",
  "music.lab.sampleRate": "Frecuencia de muestreo de salida",
  "music.lab.sourceRate": "Seguir la fuente",
  "music.lab.rateHelp":
    "No solicita una frecuencia fija. El dispositivo puede negociar otra. Una frecuencia fija remuestrea cuando hace falta; no recupera detalles perdidos en la compresión.",
  "music.lab.equalizer": "Ecualizador",
  "music.lab.mode": "Modo de ecualizador",
  "music.lab.parametric": "Paramétrico · hasta 24 filtros",
};
export default musicListeningLab;
