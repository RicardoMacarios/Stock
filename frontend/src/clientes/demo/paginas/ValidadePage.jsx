// Página que não existe na base: só o cliente demo tem (ligada em config.rotasExtras).
import PageHeader from '@/components/ui/PageHeader'

export default function ValidadePage() {
  return (
    <>
      <PageHeader titulo="Controle de validade" subtitulo="Tela exclusiva deste cliente." />
      <p className="text-sm text-texto-3">Itens com vencimento nos próximos 30 dias aparecem aqui.</p>
    </>
  )
}
