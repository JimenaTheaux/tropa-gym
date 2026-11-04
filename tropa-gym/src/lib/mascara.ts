export interface Mascara {
  tamanos: number[]
  separador: string
}

export const MASCARA_FECHA: Mascara = { tamanos: [2, 2, 4], separador: '/' }
export const MASCARA_HORA: Mascara = { tamanos: [2, 2], separador: ':' }

export interface Edicion {
  texto: string
  caret: number
}

function contarSeparadores(texto: string, m: Mascara): number {
  return texto.split(m.separador).length - 1
}

function reflujo(digitos: string, m: Mascara, alFinal: boolean): string {
  const partes: string[] = []
  let i = 0
  for (const tamano of m.tamanos) {
    const parte = digitos.slice(i, i + tamano)
    if (!parte) break
    partes.push(parte)
    i += tamano
  }
  const ultimaCompleta = partes.length > 0 && partes[partes.length - 1].length === m.tamanos[partes.length - 1]
  const cerrar = alFinal && ultimaCompleta && partes.length < m.tamanos.length && i >= digitos.length
  return partes.join(m.separador) + (cerrar ? m.separador : '')
}

function posicionTrasDigitos(texto: string, cantidad: number): number {
  let vistos = 0
  for (let i = 0; i < texto.length; i++) {
    if (vistos === cantidad) return i
    if (/\d/.test(texto[i])) vistos++
  }
  return texto.length
}

// Con todos los separadores presentes, cada parte se edita por su cuenta: tocar el
// día nunca corre los dígitos del año. Una parte llena se pisa en vez de crecer.
function editarPartes(crudo: string, caret: number, m: Mascara): Edicion {
  const partes = crudo.split(m.separador)
  let inicio = 0
  let indice = 0
  for (; indice < partes.length - 1; indice++) {
    if (caret <= inicio + partes[indice].length) break
    inicio += partes[indice].length + 1
  }
  let nuevoCaret = caret

  const tamano = m.tamanos[indice]
  if (partes[indice].length > tamano) {
    const offset = caret - inicio
    if (offset < partes[indice].length) {
      partes[indice] = partes[indice].slice(0, offset) + partes[indice].slice(offset + 1)
    } else {
      const sobrante = partes[indice].slice(tamano)
      partes[indice] = partes[indice].slice(0, tamano)
      if (indice < partes.length - 1) {
        const siguiente = partes[indice + 1]
        partes[indice + 1] = sobrante.slice(0, 1) + siguiente.slice(1)
        nuevoCaret = inicio + tamano + 2
      } else {
        nuevoCaret = inicio + tamano
      }
    }
  }

  partes.forEach((parte, i) => {
    partes[i] = parte.slice(0, m.tamanos[i])
  })
  const texto = partes.join(m.separador)
  return { texto, caret: Math.min(nuevoCaret, texto.length) }
}

export function aplicarEdicion(anterior: string, crudoSinFiltrar: string, caretSinFiltrar: number, m: Mascara): Edicion {
  const valido = (c: string) => /\d/.test(c) || c === m.separador
  const crudo = [...crudoSinFiltrar].filter(valido).join('')
  const caret = [...crudoSinFiltrar.slice(0, caretSinFiltrar)].filter(valido).length
  const total = m.tamanos.length - 1
  const separadores = contarSeparadores(crudo, m)

  if (separadores > total) return { texto: anterior, caret: Math.min(caret, anterior.length) }

  // "4/" completa la parte con un cero: 04/
  if (crudo.endsWith(m.separador) && caret === crudo.length) {
    const partes = crudo.slice(0, -1).split(m.separador)
    if (partes.every((parte, i) => parte.length > 0 && parte.length <= m.tamanos[i])) {
      const texto = partes.map((parte) => parte.padStart(2, '0')).join(m.separador) + m.separador
      return { texto, caret: texto.length }
    }
  }

  if (separadores === total) return editarPartes(crudo, caret, m)

  const alFinal = caret === crudo.length
  const digitos = crudo.replace(/\D/g, '').slice(0, m.tamanos.reduce((a, b) => a + b, 0))
  const antes = crudo.slice(0, caret).replace(/\D/g, '').length
  const texto = reflujo(digitos, m, alFinal)
  return { texto, caret: alFinal ? texto.length : posicionTrasDigitos(texto, antes) }
}

// Backspace o Suprimir sobre un separador borra el dígito de al lado, sin mover las
// demás partes. Devuelve null si la tecla no cae sobre un separador.
export function borrarSobreSeparador(texto: string, caret: number, tecla: 'Backspace' | 'Delete', m: Mascara): Edicion | null {
  if (tecla === 'Backspace') {
    if (caret === 0 || texto[caret - 1] !== m.separador) return null
    if (caret === 1 || texto[caret - 2] === m.separador) return { texto, caret: caret - 1 }
    const nuevo = texto.slice(0, caret - 2) + texto.slice(caret - 1)
    if (caret === texto.length) {
      const sinCierre = nuevo.slice(0, -1)
      return { texto: sinCierre, caret: sinCierre.length }
    }
    return { texto: nuevo, caret: caret - 2 }
  }
  if (texto[caret] !== m.separador) return null
  if (caret + 1 >= texto.length || texto[caret + 1] === m.separador) return { texto, caret: caret + 1 }
  return { texto: texto.slice(0, caret + 1) + texto.slice(caret + 2), caret: caret + 1 }
}
