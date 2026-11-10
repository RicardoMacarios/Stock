import { useState } from 'react'
import { ArrowUp, Eye, EyeOff, Loader2, Lock } from 'lucide-react'

// Peças dos formulários de entrada (login, esqueci a senha, senha nova).
//
// No celular: controles mais altos (toque) e fonte de 16px, que impede o
// iPhone de dar zoom na página ao focar o campo.

const classeEntrada =
  'w-full rounded-xl border border-borda-forte bg-fundo py-3 pl-11 text-base ' +
  'lg:rounded-(--radius-controle) lg:py-2.5 lg:pl-10 lg:text-sm ' +
  'placeholder:text-texto-3 outline-none transition focus:border-acento focus:ring-2 focus:ring-acento/30'

export function Campo({ id, rotulo, icone: Icone, acaoDoRotulo, direita, className = '', ...props }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-texto-2">{rotulo}</label>
        {acaoDoRotulo}
      </div>
      <div className="relative">
        <Icone size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-texto-3 lg:left-3" />
        <input id={id} className={`${classeEntrada} ${direita ? 'pr-11' : 'pr-3'} ${className}`} {...props} />
        {direita}
      </div>
    </div>
  )
}

// Senha com o olho para mostrar/ocultar e aviso de Caps Lock ligado.
export function CampoSenha({ id = 'senha', rotulo = 'Senha', ...props }) {
  const [ver, setVer] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const conferirCaps = (e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)

  return (
    <div>
      <Campo
        id={id}
        rotulo={rotulo}
        icone={Lock}
        type={ver ? 'text' : 'password'}
        onKeyDown={conferirCaps}
        onKeyUp={conferirCaps}
        onBlur={() => setCapsLock(false)}
        direita={
          <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-texto-3 transition hover:text-texto">
            {ver ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        {...props}
      />
      {capsLock && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-warn">
          <ArrowUp size={12} aria-hidden /> Caps Lock está ligado
        </p>
      )}
    </div>
  )
}

export function BotaoPrimario({ carregando, children, textoCarregando, ...props }) {
  return (
    <button disabled={carregando} {...props}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-acento py-3.5 font-semibold text-sobre-acento shadow-lg shadow-acento/20 transition hover:brightness-110 active:scale-[0.99] active:brightness-95 disabled:opacity-60 lg:rounded-(--radius-controle) lg:py-2.5">
      {carregando && <Loader2 size={16} className="animate-spin" />}
      {carregando ? textoCarregando : children}
    </button>
  )
}

export function Alerta({ tipo = 'erro', children }) {
  const cores = tipo === 'erro'
    ? 'border-danger/40 bg-danger/10 text-danger'
    : 'border-ok/40 bg-ok/10 text-ok'
  return (
    <p role={tipo === 'erro' ? 'alert' : 'status'}
      className={`surgir rounded-xl border px-3 py-2.5 text-sm lg:rounded-(--radius-controle) ${cores}`}>
      {children}
    </p>
  )
}
