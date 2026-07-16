export type RolUsuario = 'admin' | 'profesor' | 'kiosco'

export interface Perfil {
  id: string
  nombre: string
  rol: RolUsuario
}
