import { useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Copy, ImageUp, LayoutDashboard, Link2, Palette, ShoppingCart, Trash2, TrendingUp } from 'lucide-react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useCliente } from '@/context/useCliente'
import { traduzirErro } from '@/lib/erros'
import { classeEntrada } from '@/lib/classes'
import { corValida, textoSobre } from '@/utils/cor'
import VendedoresSecao from './VendedoresSecao'

const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp']
const LIMITE_LOGO = 1024 * 1024 // 1 MB, o mesmo do bucket

// Cores prontas: escolher num toque. Todas com contraste bom no fundo escuro.
const CORES_PRONTAS = ['#3DDC55', '#4FB3A9', '#3987E5', '#9085E9', '#D55181', '#E66767', '#E0A43B', '#D95926']

// /:slug/configuracoes — o dono troca nome, cor e logo (vale na hora para
// todo mundo daquele cliente, sem deploy) e cuida da equipe de vendas.
export default function ConfiguracoesPage() {
  const { cliente, config, ehDono, recarregar, slug } = useCliente()

  if (!supabaseConfigurado) return <p className="text-sm text-texto-3">Banco não configurado (frontend/.env).</p>
  if (!ehDono) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Configurações</h1>
        <p className="mt-2 text-sm text-texto-3">Só o dono da conta altera as configurações.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Configurações</h1>
        <p className="mt-1 text-sm text-texto-3">Aparência, equipe de vendas e acesso da sua loja.</p>
      </header>

      <div className="space-y-6">
        <Aparencia cliente={cliente} config={config} recarregar={recarregar} />
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <VendedoresSecao clienteId={cliente.id} />
          <LinkDaLoja slug={slug} />
        </div>
      </div>
    </div>
  )
}

// ── Aparência ─────────────────────────────────────────────────────────────

function Aparencia({ cliente, config, recarregar }) {
  const inicial = { nome: config.nome, cor: config.tema.corPrimaria, logo: cliente?.logo_url ?? '' }
  const [nome, setNome] = useState(inicial.nome)
  const [cor, setCor] = useState(inicial.cor)
  const [logo, setLogo] = useState(inicial.logo)
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const mudou = nome !== inicial.nome || cor.toLowerCase() !== String(inicial.cor).toLowerCase() || logo !== inicial.logo
  const corOk = corValida(cor)

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
    if (!nome.trim()) return toast.error('Informe o nome da empresa.')
    if (!corOk) return toast.error('Cor inválida. Use o formato #RRGGBB.')
    setSalvando(true)
    const { error } = await supabase.rpc('atualizar_aparencia', {
      p_cliente_id: cliente.id,
      p_nome: nome,
      p_cor_primaria: cor,
      p_logo_url: logo,
    })
    setSalvando(false)
    if (error) return toast.error(traduzirErro(error))
    toast.success('Aparência salva. Já vale para toda a equipe.')
    recarregar()
  }

  return (
    <form onSubmit={salvar} className="overflow-hidden rounded-2xl border border-borda bg-card">
      <div className="flex items-center gap-2 border-b border-borda px-5 py-4">
        <Palette size={18} className="text-acento" />
        <h2 className="font-semibold">Aparência</h2>
        <span className="ml-auto text-xs text-texto-3">Vale na hora para toda a equipe</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6 p-5">
          <label className="block text-sm font-medium text-texto-2">
            Nome da empresa
            <input required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} className={`${classeEntrada} mt-1.5`} />
          </label>

          <div>
            <p className="text-sm font-medium text-texto-2">Cor principal</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CORES_PRONTAS.map((c) => {
                const escolhida = c.toLowerCase() === cor.toLowerCase()
                return (
                  <button key={c} type="button" onClick={() => setCor(c)} aria-label={`Cor ${c}`} aria-pressed={escolhida}
                    className={`grid h-10 w-10 place-items-center rounded-xl transition hover:scale-105 ${escolhida ? 'ring-2 ring-texto ring-offset-2 ring-offset-card' : ''}`}
                    style={{ background: c, color: textoSobre(c) }}>
                    {escolhida && <Check size={18} />}
                  </button>
                )
              })}
              {/* Personalizada: seletor nativo por baixo de um quadrado com degradê */}
              <label title="Outra cor" className="relative grid h-10 w-10 cursor-pointer place-items-center overflow-hidden rounded-xl border border-borda-forte"
                style={{ background: 'conic-gradient(#e66767, #e0a43b, #3ddc55, #4fb3a9, #3987e5, #9085e9, #d55181, #e66767)' }}>
                <span className="h-4 w-4 rounded-full border-2 border-white bg-black/30" />
                <input type="color" value={corOk ? cor : '#000000'} onChange={(e) => setCor(e.target.value)}
                  aria-label="Escolher outra cor" className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="h-9 w-9 shrink-0 rounded-lg border border-borda-forte" style={{ background: corOk ? cor : 'transparent' }} />
              <input value={cor} onChange={(e) => setCor(e.target.value)} maxLength={7} aria-label="Código da cor"
                className={`${classeEntrada} w-32 py-2 font-mono uppercase`} />
              {!corOk && <span className="text-xs text-danger">Use o formato #RRGGBB</span>}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-texto-2">Logo</p>
            <div className="mt-2 flex items-center gap-4 rounded-2xl border border-dashed border-borda-forte p-4">
              {logo
                ? <img src={logo} alt="Logo atual" className="h-16 w-16 rounded-xl bg-fundo object-contain" />
                : <span className="grid h-16 w-16 place-items-center rounded-xl bg-fundo text-texto-3"><ImageUp size={24} /></span>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer rounded-lg border border-borda-forte px-3 py-1.5 text-sm font-medium transition hover:bg-elevado">
                    {enviandoLogo ? 'Enviando…' : logo ? 'Trocar imagem' : 'Escolher imagem'}
                    <input type="file" accept={TIPOS_LOGO.join(',')} onChange={enviarLogo} className="hidden" disabled={enviandoLogo} />
                  </label>
                  {logo && (
                    <button type="button" onClick={() => setLogo('')}
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-texto-3 hover:text-danger">
                      <Trash2 size={14} /> Remover
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-texto-3">PNG, JPG ou WEBP, até 1 MB. Quadrado fica melhor.</p>
              </div>
            </div>
          </div>
        </div>

        <Previa nome={nome || 'Sua loja'} cor={corOk ? cor : config.tema.corPrimaria} logo={logo} />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-borda px-5 py-4">
        {mudou && (
          <button type="button" onClick={() => { setNome(inicial.nome); setCor(inicial.cor); setLogo(inicial.logo) }}
            className="text-sm text-texto-3 hover:text-texto">
            Desfazer
          </button>
        )}
        <button disabled={!mudou || salvando || enviandoLogo}
          className="rounded-xl bg-acento px-5 py-2.5 font-semibold text-sobre-acento transition hover:brightness-110 disabled:opacity-40">
          {salvando ? 'Salvando…' : mudou ? 'Salvar alterações' : 'Tudo salvo'}
        </button>
      </div>
    </form>
  )
}

// Mini tela com o nome, a cor e o logo escolhidos, antes de salvar.
function Previa({ nome, cor, logo }) {
  const tinta = textoSobre(cor)
  return (
    <div className="border-t border-borda bg-fundo/50 p-5 lg:border-l lg:border-t-0">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-texto-3">Prévia</p>
      <div className="overflow-hidden rounded-xl border border-borda bg-fundo shadow-xl">
        <div className="flex items-center gap-2.5 border-b border-borda bg-card px-3 py-2.5">
          {logo
            ? <img src={logo} alt="" className="h-7 w-7 rounded-lg object-contain" />
            : <span className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold" style={{ background: cor, color: tinta }}>{nome.charAt(0).toUpperCase()}</span>}
          <span className="truncate text-sm font-semibold">{nome}</span>
        </div>
        <div className="space-y-3 p-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold" style={{ background: `${cor}1f` }}>
            <LayoutDashboard size={14} style={{ color: cor }} /> Dashboard
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-borda bg-card p-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: cor, color: tinta }}>
              <TrendingUp size={16} />
            </span>
            <div>
              <p className="text-[0.65rem] text-texto-3">Lucro</p>
              <p className="text-sm font-bold">R$ 434,10</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold" style={{ background: cor, color: tinta }}>
            <ShoppingCart size={14} /> Nova venda
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Link da loja ──────────────────────────────────────────────────────────

function LinkDaLoja({ slug }) {
  const [copiado, setCopiado] = useState(false)
  const link = `${location.origin}/${slug}`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast(link)
    }
  }

  return (
    <section className="rounded-2xl border border-borda bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Link2 size={18} className="text-acento" /> Endereço da loja</h2>
      <p className="mt-1 text-sm text-texto-3">Mande para a equipe: abre direto o login com a cara da sua loja.</p>
      <div className="mt-4 flex gap-2">
        <code className="flex min-w-0 flex-1 items-center truncate rounded-xl border border-borda-forte bg-fundo px-3 py-2.5 text-sm text-texto-2">
          {link.replace(/^https?:\/\//, '')}
        </code>
        <button onClick={copiar}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-borda-forte px-3.5 text-sm font-medium transition hover:border-acento hover:text-acento">
          {copiado ? <Check size={15} className="text-ok" /> : <Copy size={15} />} {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </section>
  )
}
