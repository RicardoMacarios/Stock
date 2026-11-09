import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { erro: null }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    console.error(erro, info)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-bold">Algo deu errado.</h1>
          <p className="mt-2 text-sm text-texto-2">{String(this.state.erro.message ?? this.state.erro)}</p>
          <button onClick={() => location.reload()} className="mt-4 rounded px-4 py-2 bg-acento text-sobre-acento">
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}
