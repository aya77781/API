'use client'

import { useEffect, useState } from 'react'
import { Receipt, Loader2, Check, X, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type NoteFrais = {
  id: string
  user_id: string
  libelle: string
  categorie: string
  montant_ttc: number
  tva_pct: number
  date_depense: string
  projet_id: string | null
  commentaire: string | null
  justificatif_url: string | null
  statut: 'soumise' | 'validee' | 'refusee' | 'remboursee'
  motif_refus: string | null
  created_at: string
}
type Profil = { id: string; prenom: string | null; nom: string | null; role: string | null }
type Projet = { id: string; nom: string }

const STATUT_BADGE: Record<string, string> = {
  soumise:    'bg-amber-50 text-amber-700 border border-amber-200',
  validee:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  refusee:    'bg-red-50 text-red-700 border border-red-200',
  remboursee: 'bg-blue-50 text-blue-700 border border-blue-200',
}
const STATUT_LABEL: Record<string, string> = {
  soumise: 'À valider',
  validee: 'Validée',
  refusee: 'Refusée',
  remboursee: 'Remboursée',
}

export function NotesFraisValidation() {
  const supabase = createClient()
  const [notes, setNotes] = useState<NoteFrais[]>([])
  const [profils, setProfils] = useState<Profil[]>([])
  const [projets, setProjets] = useState<Projet[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState<string>('soumise')
  const [filterUser, setFilterUser] = useState<string>('all')
  const [refusing, setRefusing] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [n, p, pr] = await Promise.all([
      supabase.from('notes_frais').select('*').order('created_at', { ascending: false }),
      supabase.schema('app').from('utilisateurs').select('id,prenom,nom,role'),
      supabase.from('projets').select('id,nom'),
    ])
    setNotes((n.data ?? []) as NoteFrais[])
    setProfils((p.data ?? []) as Profil[])
    setProjets((pr.data ?? []) as Projet[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const employeNom = (uid: string) => {
    const p = profils.find(x => x.id === uid)
    return p ? `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || 'Utilisateur' : 'Utilisateur'
  }
  const employeRole = (uid: string) => profils.find(x => x.id === uid)?.role ?? ''
  const projetNom = (id: string | null) => id ? (projets.find(p => p.id === id)?.nom ?? '—') : '—'

  const filtered = notes.filter(n =>
    (filterStatut === 'all' || n.statut === filterStatut) &&
    (filterUser === 'all' || n.user_id === filterUser)
  )

  const totalAValider = notes
    .filter(n => n.statut === 'soumise')
    .reduce((s, n) => s + Number(n.montant_ttc), 0)
  const totalValide = notes
    .filter(n => n.statut === 'validee')
    .reduce((s, n) => s + Number(n.montant_ttc), 0)
  const totalRembourse = notes
    .filter(n => n.statut === 'remboursee')
    .reduce((s, n) => s + Number(n.montant_ttc), 0)

  async function valider(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('notes_frais').update({
      statut: 'validee',
      validee_par: user?.id,
      validee_le: new Date().toISOString(),
      motif_refus: null,
    }).eq('id', id)
    load()
  }

  async function refuser(id: string) {
    const motif = prompt('Motif du refus :')
    if (!motif) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('notes_frais').update({
      statut: 'refusee',
      validee_par: user?.id,
      validee_le: new Date().toISOString(),
      motif_refus: motif,
    }).eq('id', id)
    setRefusing(null)
    load()
  }

  async function marquerRembourse(id: string) {
    await supabase.from('notes_frais').update({ statut: 'remboursee' }).eq('id', id)
    load()
  }

  const employesAvecNDF = Array.from(new Set(notes.map(n => n.user_id)))

  return (
    <div>
      <TopBar
        title="Validation des notes de frais"
        subtitle="Valider ou refuser les notes de frais soumises par les employés"
      />
      <div className="p-6 space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500">À valider</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{totalAValider.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700">
              {notes.filter(n => n.statut === 'soumise').length} note(s)
            </span>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500">Validées (à rembourser)</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{totalValide.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
              {notes.filter(n => n.statut === 'validee').length} note(s)
            </span>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500">Remboursées</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{totalRembourse.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
              {notes.filter(n => n.statut === 'remboursee').length} note(s)
            </span>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">Tous statuts</option>
            <option value="soumise">À valider</option>
            <option value="validee">Validées</option>
            <option value="refusee">Refusées</option>
            <option value="remboursee">Remboursées</option>
          </select>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">Tous les employés</option>
            {employesAvecNDF.map(uid => (
              <option key={uid} value={uid}>{employeNom(uid)}</option>
            ))}
          </select>
          <button
            onClick={load}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 px-2 py-2"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} note(s)</span>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucune note de frais</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Employé</th>
                  <th className="px-4 py-3">Libellé</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Projet</th>
                  <th className="px-4 py-3 text-right">Montant TTC</th>
                  <th className="px-4 py-3 text-right">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{new Date(n.date_depense).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{employeNom(n.user_id)}</div>
                      <div className="text-xs text-gray-400">{employeRole(n.user_id)}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {n.libelle}
                      {n.justificatif_url && (
                        <a
                          href={n.justificatif_url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-xs text-blue-600 underline"
                        >
                          Justificatif
                        </a>
                      )}
                      {n.commentaire && <p className="text-xs text-gray-500 mt-0.5">{n.commentaire}</p>}
                      {n.statut === 'refusee' && n.motif_refus && (
                        <p className="text-xs text-red-600 mt-0.5">Refus : {n.motif_refus}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{n.categorie}</td>
                    <td className="px-4 py-3 text-gray-600">{projetNom(n.projet_id)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {Number(n.montant_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUT_BADGE[n.statut]}`}>
                        {STATUT_LABEL[n.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {n.statut === 'soumise' && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => valider(n.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200"
                            title="Valider"
                          >
                            <Check className="w-3.5 h-3.5" /> Valider
                          </button>
                          <button
                            onClick={() => refuser(n.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded border border-red-200"
                            title="Refuser"
                          >
                            <X className="w-3.5 h-3.5" /> Refuser
                          </button>
                        </div>
                      )}
                      {n.statut === 'validee' && (
                        <button
                          onClick={() => marquerRembourse(n.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200"
                        >
                          Marquer remboursée
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
