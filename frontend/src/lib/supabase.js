import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sem .env o app ainda abre (modo só-código), para dar para ver a estrutura e
// as personalizações de cliente antes de ligar o banco.
export const supabaseConfigurado = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = supabaseConfigurado
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
