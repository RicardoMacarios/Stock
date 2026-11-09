import { useEffect } from 'react'
import { carregarEstiloDoCliente } from '@/clientes/registro'

// Aplica o tema do cliente no <html> e liga o estilo.css dele, se existir.
// Ao sair do cliente (ou trocar de slug), desfaz tudo: o próximo começa da base.
export function useTemaDoCliente(slug, tema, nome) {
  useEffect(() => {
    const raiz = document.documentElement.style
    if (tema?.corPrimaria) raiz.setProperty('--cor-primaria', tema.corPrimaria)
    if (tema?.corPrimariaInk) raiz.setProperty('--cor-primaria-ink', tema.corPrimariaInk)
    const tituloAnterior = document.title
    if (nome) document.title = nome

    return () => {
      raiz.removeProperty('--cor-primaria')
      raiz.removeProperty('--cor-primaria-ink')
      document.title = tituloAnterior
    }
  }, [tema?.corPrimaria, tema?.corPrimariaInk, nome])

  useEffect(() => {
    let tag = null
    let cancelado = false
    carregarEstiloDoCliente(slug).then((css) => {
      if (cancelado || !css) return
      tag = document.createElement('style')
      tag.dataset.cliente = slug
      tag.textContent = css
      document.head.appendChild(tag)
    })
    return () => {
      cancelado = true
      tag?.remove()
    }
  }, [slug])
}
