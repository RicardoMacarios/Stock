// Cliente de EXEMPLO. Pode apagar a pasta quando não precisar mais.

export default {
  nome: 'Distribuidora Demo',

  tema: { corPrimaria: '#E0A43B', corPrimariaInk: '#14110A' },

  // Aba nova que só este cliente tem (tela em ./paginas/ValidadePage.jsx).
  rotasExtras: [
    { caminho: 'validade', pagina: 'ValidadePage', rotulo: 'Validade', icone: 'FileText' },
  ],
}
