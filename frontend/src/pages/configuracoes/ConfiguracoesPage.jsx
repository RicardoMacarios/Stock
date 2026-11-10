import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useCliente } from '@/context/useCliente'
import { traduzirErro } from '@/lib/erros'
import { classeCampo } from '@/lib/classes'
import { corValida, textoSobre } from '@/utils/cor'
import PageHeader from '@/components/ui/PageHeader'

const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp']
const LIMITE_LOGO = 1024 * 1024 // 1 MB, o mesmo do bucket

// /:slug/configuracoes — o dono troca nome, cor e logo. Salvou, vale na hora
// para todo mundo daquele cliente, sem deploy.
export default function ConfiguracoesPage() {
  const { cliente, config, ehDono, recarregar } = useCliente()
  const [nome, setNome] = useState(config.nome)
  const [cor, setCor] = useState(config.tema.corPrimaria)
  const [logo, setLogo] = useState(cliente?.logo_url ?? '')
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  if (!supabaseConfigurado) {
    return <><PageHeader titulo="Configurações" /><p className="text-sm text-texto-3">Banco não configurado (frontend/.env).</p></>
  }
  if (!ehDono) {
    return <><PageHeader titulo="Configurações" /><p className="text-sm text-texto-3">Só o dono da conta altera as configurações.</p></>
  }

  async function enviarLogo(e) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    if (!TIPOS_LOGO.includes(arquivo.type)) return toast.error('Use PNG, JPG ou WEBP.')
    if (arquivo.size > LIMITE_LOGO) return toast.error('O logo pode ter até 1 MB.')

    setEnviandoLogo(true)
    // Nome novo a cada envio: evita cache do navegador mostrando o logo antigo.
    const caminho = `${cliente.id}/logo-${Date.now()}.${arquivo.name.split('.').pop().toLowerCase()}`
    const { error } = await supabase.storage.from('logos').upload(caminho, arquivo, { contentType: arquivo.type })
    setEnviandoLogo(false)
    if (error) return toast.error('Não foi possível enviar o logo.')
    setLogo(supabase.storage.from('logos').getPublicUrl(caminho).data.publicUrl)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!corValida(cor)) return toast.error('Cor inválida.')
    setSalvando(true)
    const { error } = await supabase.rpc('atualizar_aparencia', {
      p_cliente_id: cliente.id,
      p_nome: nome,
      p_cor_primaria: cor,
      p_logo_url: logo,
    })
    setSalvando(false)
    if (error) return toast.error(traduzirErro(error))
    toast.success('Salvo!')
    recarregar()
  }

  return (
    <>
      <PageHeader titulo="Configurações" subtitulo="Aparência do sistema para toda a sua equipe." />

      <form onSubmit={salvar} className="max-w-lg space-y-6 rounded-lg border border-borda bg-card p-6">
        <label className="block text-sm">
          Nome da empresa
          <input required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)}
            className={`${classeCampo} mt-1`} />
        </label>

        <div className="text-sm">
          Cor principal
          <div className="mt-1 flex items-center gap-3">
            <input type="color" value={corValida(cor) ? cor : '#000000'} onChange={(e) => setCor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-borda-forte bg-fundo" />
            <input value={cor} onChange={(e) => setCor(e.target.value)} maxLength={7}
              className={`${classeCampo} w-32 font-mono`} />
            {corValida(cor) && (
              <span className="rounded px-3 py-2 text-sm font-semibold" style={{ background: cor, color: textoSobre(cor) }}>
                Prévia
              </span>
            )}
          </div>
        </div>

        <div className="text-sm">
          Logo
          <div className="mt-1 flex items-center gap-4">
            {logo
              ? <img src={logo} alt="" className="h-14 w-14 rounded object-contain bg-fundo" />
              : <span className="grid h-14 w-14 place-items-center rounded bg-fundo text-xs text-texto-3">sem logo</span>}
            <label className="cursor-pointer rounded border border-borda-forte px-3 py-2 hover:bg-elevado">
              {enviandoLogo ? 'Enviando…' : 'Escolher imagem'}
              <input type="file" accept={TIPOS_LOGO.join(',')} onChange={enviarLogo} className="hidden" disabled={enviandoLogo} />
            </label>
            {logo && <button type="button" onClick={() => setLogo('')} className="text-texto-3 underline">Remover</button>}
          </div>
          <p className="mt-1 text-xs text-texto-3">PNG, JPG ou WEBP, até 1 MB. Quadrado fica melhor.</p>
        </div>

        <button disabled={salvando || enviandoLogo}
          className="rounded px-4 py-2 font-semibold bg-acento text-sobre-acento disabled:opacity-60">
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </>
  )
}
