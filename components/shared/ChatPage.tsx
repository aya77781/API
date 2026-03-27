'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  MessageSquare, Send, Paperclip, Users, X,
  FileText, Download, Image, Music, File,
  PenSquare, Search, User, Upload,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useChat, type ChatGroupe, type ChatMessage, type ChatMembre } from '@/hooks/useChat'
import { createClient } from '@/lib/supabase/client'
import { DocumentUploadModal } from '@/components/shared/DocumentUploadModal'

/* ── Helpers ── */

function initiales(prenom: string, nom: string) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase()
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function timeShort(date: string) {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return "à l'instant"
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function dateLabel(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

const ROLE_LABELS: Record<string, string> = {
  co: 'CO', commercial: 'Commercial', economiste: 'Économiste',
  dessinatrice: 'Dessin', comptable: 'Comptable', gerant: 'Direction',
  admin: 'Admin', rh: 'RH', cho: 'CHO', assistant_travaux: 'AT', st: 'ST',
}

const TYPE_LABELS: Record<string, string> = {
  cr: 'Compte-rendu', plan_exe: 'Plan EXE', plan_apd: 'Plan APD',
  plan_doe: 'Plan DOE', cctp: 'CCTP', devis: 'Devis', contrat: 'Contrat',
  rapport_bc: 'Rapport BC', facture: 'Facture', photo: 'Photo',
  audio_reunion: 'Audio', kbis: 'Kbis', assurance: 'Assurance',
  urssaf: 'Urssaf', rib: 'RIB', autre: 'Autre',
}

/* ── Render message text with @mentions highlighted ── */
function renderContenu(contenu: string | null) {
  if (!contenu) return null
  const parts = contenu.split(/(@\w+(?:\s\w+)?)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@')
          ? <span key={i} className="text-blue-600 bg-blue-50 rounded px-0.5 font-medium">{part}</span>
          : part
      )}
    </>
  )
}

/* ── Document card inside a message ── */
function DocCard({ doc, supabase }: { doc: NonNullable<ChatMessage['document']>; supabase: ReturnType<typeof createClient> }) {
  async function download() {
    const { data } = await supabase.storage.from('projets').createSignedUrl(doc.storage_path, 3600)
    if (!data) return
    const a = document.createElement('a'); a.href = data.signedUrl; a.download = doc.nom_fichier; a.target = '_blank'; a.click()
  }
  return (
    <div className="mt-1.5 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 max-w-xs">
      <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
        <FileText className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{doc.nom_fichier}</p>
        <p className="text-xs text-gray-400">{TYPE_LABELS[doc.type_doc] ?? doc.type_doc}{doc.taille_octets ? ` · ${formatSize(doc.taille_octets)}` : ''}</p>
      </div>
      <button onClick={download} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */

interface Props {
  roleBase: string
  groupeId?: string
  fetchAll?: boolean
}

export function ChatPage({ roleBase, groupeId, fetchAll }: Props) {
  const { user, profil } = useUser()
  const chat = useChat()
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  const [groupes, setGroupes] = useState<ChatGroupe[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [membres, setMembres] = useState<ChatMembre[]>([])
  const [loadingGroupes, setLoadingGroupes] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [membresOpen, setMembresOpen] = useState(false)
  const [dmOpen, setDmOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<{ id: string; prenom: string; nom: string; role: string }[]>([])
  const [dmQuery, setDmQuery] = useState('')
  const [dmLoading, setDmLoading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const pathParts = pathname.split('/')
  const projetIdFromUrl = pathParts[2] === 'projets' && pathParts[3] ? pathParts[3] : undefined

  const [input, setInput] = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionSuggestions, setMentionSuggestions] = useState<ChatMembre[]>([])
  const [mentionUuids, setMentionUuids] = useState<string[]>([])
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const selectedGroupe = groupes.find(g => g.id === groupeId) ?? null

  /* ── Load groups ── */
  const loadGroupes = useCallback(async () => {
    if (!user) return
    const data = fetchAll
      ? await chat.fetchTousGroupesForChat(user.id)
      : await chat.fetchMesGroupes(user.id)
    setGroupes(data)
    setLoadingGroupes(false)
  }, [user, fetchAll])

  useEffect(() => { loadGroupes() }, [loadGroupes])

  /* ── Load all users for DM picker ── */
  useEffect(() => {
    supabase.schema('app').from('utilisateurs')
      .select('id, prenom, nom, role').eq('actif', true).order('prenom')
      .then(({ data }) => setAllUsers(data ?? []))
  }, [])

  /* ── Start or open existing DM with a user ── */
  async function openDM(targetId: string, targetPrenom: string, targetNom: string) {
    if (!user) return
    setDmLoading(true)

    // Check if a DM group already exists between these two users
    const { data: myMemberships } = await supabase.schema('app')
      .from('chat_membres').select('groupe_id').eq('utilisateur_id', user.id)
    const { data: theirMemberships } = await supabase.schema('app')
      .from('chat_membres').select('groupe_id').eq('utilisateur_id', targetId)

    const myIds   = new Set((myMemberships ?? []).map((m: { groupe_id: string }) => m.groupe_id))
    const theirIds = (theirMemberships ?? []).map((m: { groupe_id: string }) => m.groupe_id)
    const commonIds = theirIds.filter((id: string) => myIds.has(id))

    let dmGroupeId: string | null = null

    if (commonIds.length > 0) {
      // Find a DM (type=libre, no projet, exactly 2 members)
      const { data: candidates } = await supabase.schema('app')
        .from('chat_groupes').select('id').in('id', commonIds)
        .eq('type', 'libre').is('projet_id', null)
      if (candidates?.length) {
        for (const c of candidates) {
          const { count } = await supabase.schema('app').from('chat_membres')
            .select('id', { count: 'exact', head: true }).eq('groupe_id', c.id)
          if (count === 2) { dmGroupeId = c.id; break }
        }
      }
    }

    if (!dmGroupeId) {
      const myName = profil ? `${profil.prenom} ${profil.nom}` : 'Moi'
      const { error, groupeId: newId } = await chat.createGroupe(
        `${myName} & ${targetPrenom} ${targetNom}`,
        'libre', null, null, user.id,
        [{ userId: user.id, estAdmin: true }, { userId: targetId, estAdmin: false }]
      )
      if (!error && newId) dmGroupeId = newId
    }

    setDmLoading(false)
    setDmOpen(false)
    setDmQuery('')
    if (dmGroupeId) {
      await loadGroupes()
      router.push(`/${roleBase}/chat/${dmGroupeId}`)
    }
  }

  /* ── Load messages when group changes ── */
  useEffect(() => {
    if (!groupeId || !user) return
    setLoadingMessages(true)
    setMessages([])

    Promise.all([
      chat.fetchMessages(groupeId),
      chat.fetchGroupeMembers(groupeId),
    ]).then(([msgs, membs]) => {
      setMessages(msgs)
      setMembres(membs)
      setLoadingMessages(false)
      if (msgs.length > 0) {
        chat.markLu(groupeId, user.id, msgs[msgs.length - 1].id)
      }
    })
  }, [groupeId, user])

  /* ── Scroll to bottom ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ── Realtime ── */
  useEffect(() => {
    if (!groupeId || !user) return

    if (channelRef.current) supabase.removeChannel(channelRef.current)

    channelRef.current = supabase
      .channel(`chat_conv_${groupeId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'app', table: 'chat_messages',
        filter: `groupe_id=eq.${groupeId}`,
      }, async (payload) => {
        const raw = payload.new as ChatMessage
        const { data } = await supabase
          .schema('app').from('chat_messages')
          .select('*, auteur:utilisateurs!auteur_id(id, prenom, nom, role), document:documents(id, nom_fichier, type_doc, taille_octets, storage_path)')
          .eq('id', raw.id).single()
        if (data) {
          setMessages(prev => [...prev, data as ChatMessage])
          setGroupes(prev => prev.map(g => g.id === groupeId ? { ...g, dernierMessage: data as ChatMessage } : g))
          chat.markLu(groupeId, user.id, raw.id)
        }
      })
      .subscribe()

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [groupeId, user])

  /* ── Mark read on mount ── */
  useEffect(() => {
    if (!groupeId || !user || messages.length === 0) return
    chat.markLu(groupeId, user.id, messages[messages.length - 1].id)
    setGroupes(prev => prev.map(g => g.id === groupeId ? { ...g, unreadCount: 0 } : g))
  }, [groupeId, messages.length > 0])

  /* ── Mention detection ── */
  function handleInputChange(value: string) {
    setInput(value)
    const lastAt = value.lastIndexOf('@')
    if (lastAt !== -1 && (lastAt === 0 || value[lastAt - 1] === ' ' || value[lastAt - 1] === '\n')) {
      const query = value.slice(lastAt + 1)
      if (!query.includes(' ') && query.length <= 20) {
        setMentionQuery(query)
        const filtered = membres.filter(m =>
          m.utilisateur && (
            `${m.utilisateur.prenom} ${m.utilisateur.nom}`.toLowerCase().includes(query.toLowerCase()) ||
            m.utilisateur.role.toLowerCase().includes(query.toLowerCase())
          ) && m.utilisateur_id !== user?.id
        )
        setMentionSuggestions(filtered.slice(0, 6))
        return
      }
    }
    setMentionQuery(null)
    setMentionSuggestions([])
  }

  function insertMention(membre: ChatMembre) {
    if (!membre.utilisateur) return
    const lastAt = input.lastIndexOf('@')
    const before = input.slice(0, lastAt)
    const mention = `@${membre.utilisateur.prenom} `
    setInput(before + mention)
    setMentionUuids(prev => [...new Set([...prev, membre.utilisateur_id])])
    setMentionQuery(null)
    setMentionSuggestions([])
    inputRef.current?.focus()
  }

  /* ── Send text message ── */
  async function handleSend() {
    if (!groupeId || !user) return

    // Send pending file first
    if (pendingFile) {
      await handleSendFile()
      return
    }

    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    setMentionUuids([])

    const tempMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      groupe_id: groupeId,
      auteur_id: user.id,
      contenu: text,
      document_id: null,
      mentions: mentionUuids,
      created_at: new Date().toISOString(),
      modifie_at: null,
      supprime: false,
      auteur: profil ? { id: user.id, prenom: profil.prenom, nom: profil.nom, role: profil.role } : null,
      document: null,
    }
    setMessages(prev => [...prev, tempMsg])

    const { error } = await chat.sendMessage(groupeId, user.id, text, mentionUuids)
    if (error) setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
  }

  /* ── Upload file + send as document message ── */
  async function handleSendFile() {
    if (!pendingFile || !groupeId || !user) return
    setSending(true)

    const ext  = pendingFile.name.split('.').pop()?.toLowerCase() ?? ''
    const path = `chat/${groupeId}/${Date.now()}_${pendingFile.name}`

    const { error: uploadErr } = await supabase.storage
      .from('projets').upload(path, pendingFile, { upsert: true })

    if (uploadErr) { setSending(false); return }

    // Detect type_doc from extension
    const typeDoc = ['jpg','jpeg','png','gif','webp'].includes(ext) ? 'photo'
      : ['mp3','m4a','wav','ogg'].includes(ext) ? 'audio_reunion'
      : 'autre'

    const { data: doc, error: docErr } = await supabase.schema('app').from('documents').insert({
      projet_id:     selectedGroupe?.projet_id ?? null,
      uploaded_by:   user.id,
      nom_fichier:   pendingFile.name,
      type_doc:      typeDoc,
      storage_path:  path,
      taille_octets: pendingFile.size,
      tags:          [],
    }).select('id').single()

    if (!docErr && doc) {
      await chat.sendDocument(groupeId, user.id, doc.id)
    }

    setPendingFile(null)
    setSending(false)
    loadGroupes()
  }

  /* ── Group list item ── */
  function GroupItem({ g }: { g: ChatGroupe }) {
    const isActive = g.id === groupeId
    return (
      <button
        onClick={() => router.push(`/${roleBase}/chat/${g.id}`)}
        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
          isActive
            ? 'bg-white border-l-2 border-gray-900'
            : 'border-l-2 border-transparent hover:bg-white/60'
        }`}
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${g.type === 'libre' ? 'bg-gray-100 border border-gray-200' : 'bg-gray-200'}`}>
          {g.type === 'libre'
            ? <User className="w-4 h-4 text-gray-500" />
            : <span className="text-xs font-bold text-gray-600">{g.nom.slice(0, 2).toUpperCase()}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className={`text-sm truncate ${isActive ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
              {g.nom}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {g.dernierMessage && (
                <span className="text-xs text-gray-400">{timeShort(g.dernierMessage.created_at)}</span>
              )}
              {(g.unreadCount ?? 0) > 0 && (
                <span className="min-w-[1.25rem] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                  {(g.unreadCount ?? 0) > 99 ? '99+' : g.unreadCount}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {g.type === 'projet' && (
              <span className="text-xs bg-blue-100 text-blue-700 font-medium px-1.5 py-0.5 rounded">Projet</span>
            )}
            {g.dernierMessage?.contenu && (
              <p className="text-xs text-gray-400 truncate">{g.dernierMessage.contenu.slice(0, 40)}</p>
            )}
            {g.dernierMessage?.document_id && !g.dernierMessage.contenu && (
              <p className="text-xs text-gray-400 italic">Document partagé</p>
            )}
          </div>
        </div>
      </button>
    )
  }

  /* ── Empty state ── */
  if (loadingGroupes) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* ── Left: groups list ── */}
      <div className="w-72 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Messages</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setUploadOpen(true)}
              title="Deposer un document"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setDmOpen(v => !v); setDmQuery('') }}
              title="Nouveau message prive"
              className={`p-1.5 rounded-lg transition-colors ${dmOpen ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}>
              <PenSquare className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* DM user picker */}
        {dmOpen && (
          <div className="border-b border-gray-200 bg-white">
            <div className="px-3 pt-3 pb-2">
              <p className="text-xs font-semibold text-gray-500 mb-2">Nouveau message privé</p>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={dmQuery}
                  onChange={e => setDmQuery(e.target.value)}
                  placeholder="Rechercher un utilisateur…"
                  className="flex-1 bg-transparent text-xs text-gray-900 outline-none placeholder:text-gray-400"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto pb-2">
              {dmLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                </div>
              ) : (
                allUsers
                  .filter(u => u.id !== user?.id)
                  .filter(u => dmQuery.trim()
                    ? `${u.prenom} ${u.nom}`.toLowerCase().includes(dmQuery.toLowerCase()) ||
                      u.role.toLowerCase().includes(dmQuery.toLowerCase())
                    : true
                  )
                  .map(u => (
                    <button
                      key={u.id}
                      onClick={() => openDM(u.id, u.prenom, u.nom)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left transition-colors">
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                        {initiales(u.prenom, u.nom)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{u.prenom} {u.nom}</p>
                        <p className="text-xs text-gray-400">{ROLE_LABELS[u.role] ?? u.role}</p>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-1">
          {groupes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">Aucun groupe de discussion</p>
            </div>
          ) : (
            groupes.map(g => <GroupItem key={g.id} g={g} />)
          )}
        </div>
      </div>

      {/* ── Right: conversation ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!groupeId || !selectedGroupe ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <MessageSquare className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-600">Sélectionnez un groupe</p>
            <p className="text-xs text-gray-400 mt-1">Choisissez une conversation dans la liste</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-5 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                  {selectedGroupe.nom.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{selectedGroupe.nom}</p>
                  <div className="flex items-center gap-2">
                    {selectedGroupe.type === 'projet' && selectedGroupe.projet && (
                      <Link href={`/${roleBase}/projets/${selectedGroupe.projet.id}`}
                        className="text-xs text-blue-600 hover:underline truncate">
                        {selectedGroupe.projet.nom}
                      </Link>
                    )}
                    <span className="text-xs text-gray-400">{membres.length} membre{membres.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Avatars empilés */}
                <div className="flex -space-x-1.5">
                  {membres.slice(0, 4).map((m, i) => (
                    <div key={m.id}
                      className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-600"
                      style={{ zIndex: 4 - i }}>
                      {m.utilisateur ? initiales(m.utilisateur.prenom, m.utilisateur.nom) : '?'}
                    </div>
                  ))}
                  {membres.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-500">
                      +{membres.length - 4}
                    </div>
                  )}
                </div>
                <button onClick={() => setMembresOpen(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                    membresOpen ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}>
                  <Users className="w-3.5 h-3.5" />
                  Membres
                </button>
              </div>
            </div>

            {/* Messages area + members panel */}
            <div className="flex-1 flex min-h-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare className="w-8 h-8 text-gray-200 mb-2" />
                    <p className="text-xs text-gray-400">Aucun message pour l'instant</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.auteur_id === user?.id
                    const prevMsg = idx > 0 ? messages[idx - 1] : null
                    const showDate = !prevMsg || !isSameDay(prevMsg.created_at, msg.created_at)
                    const showAuthor = !isMe && (!prevMsg || prevMsg.auteur_id !== msg.auteur_id || showDate)

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs text-gray-400 font-medium px-2">{dateLabel(msg.created_at)}</span>
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                        )}

                        <div className={`flex items-end gap-2 my-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                          {!isMe && (
                            <div className={`w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0 mb-1 ${!showAuthor ? 'opacity-0' : ''}`}>
                              {msg.auteur ? initiales(msg.auteur.prenom, msg.auteur.nom) : '?'}
                            </div>
                          )}
                          <div className={`max-w-[65%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                            {showAuthor && msg.auteur && (
                              <p className="text-xs text-gray-500 mb-0.5 px-1">
                                {msg.auteur.prenom} {msg.auteur.nom}
                                <span className="ml-1 text-gray-300">{ROLE_LABELS[msg.auteur.role] ?? msg.auteur.role}</span>
                              </p>
                            )}
                            <div className={`rounded-2xl px-3 py-2 ${
                              isMe
                                ? 'bg-gray-100 text-gray-900 rounded-br-sm'
                                : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                            }`}>
                              {msg.contenu && (
                                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                  {renderContenu(msg.contenu)}
                                </p>
                              )}
                              {msg.document && <DocCard doc={msg.document} supabase={supabase} />}
                            </div>
                            <span className="text-xs text-gray-300 mt-0.5 px-1">
                              {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Members panel */}
              {membresOpen && (
                <div className="w-64 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
                  <div className="h-12 flex items-center justify-between px-4 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">Membres</p>
                    <button onClick={() => setMembresOpen(false)} className="p-1 text-gray-400 hover:text-gray-700 rounded-md">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto py-2">
                    {membres.map(m => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                          {m.utilisateur ? initiales(m.utilisateur.prenom, m.utilisateur.nom) : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {m.utilisateur?.prenom} {m.utilisateur?.nom}
                          </p>
                          <p className="text-xs text-gray-400">{ROLE_LABELS[m.utilisateur?.role ?? ''] ?? m.utilisateur?.role}</p>
                        </div>
                        {m.est_admin && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">Admin</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input zone */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">

              {/* @mention suggestions */}
              {mentionSuggestions.length > 0 && (
                <div className="mb-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  {mentionSuggestions.map(m => (
                    <button key={m.id} onClick={() => insertMention(m)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left transition-colors">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                        {m.utilisateur ? initiales(m.utilisateur.prenom, m.utilisateur.nom) : '?'}
                      </div>
                      <span className="text-sm text-gray-900">{m.utilisateur?.prenom} {m.utilisateur?.nom}</span>
                      <span className="text-xs text-gray-400">{ROLE_LABELS[m.utilisateur?.role ?? ''] ?? ''}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Pending file preview */}
              {pendingFile && (
                <div className="mb-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    {['jpg','jpeg','png','gif','webp'].includes(pendingFile.name.split('.').pop()?.toLowerCase() ?? '')
                      ? <Image className="w-4 h-4 text-blue-500" />
                      : ['mp3','m4a','wav'].includes(pendingFile.name.split('.').pop()?.toLowerCase() ?? '')
                      ? <Music className="w-4 h-4 text-blue-500" />
                      : pendingFile.name.endsWith('.pdf')
                      ? <FileText className="w-4 h-4 text-blue-500" />
                      : <File className="w-4 h-4 text-blue-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-blue-800 truncate">{pendingFile.name}</p>
                    <p className="text-xs text-blue-500">{formatSize(pendingFile.size)}</p>
                  </div>
                  <button onClick={() => setPendingFile(null)} className="text-blue-400 hover:text-blue-700 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="*/*"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null
                  if (f) setPendingFile(f)
                  e.target.value = ''
                }}
              />

              <div className="flex items-end gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 mb-0.5 ${
                    pendingFile ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                  }`}>
                  <Paperclip className="w-4 h-4" />
                </button>
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => handleInputChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (mentionSuggestions.length > 0) { insertMention(mentionSuggestions[0]); return }
                        handleSend()
                      }
                    }}
                    placeholder={pendingFile ? 'Ajouter un message (optionnel)…' : 'Écrivez un message… (@ pour mentionner)'}
                    rows={1}
                    className="w-full bg-transparent text-sm text-gray-900 outline-none resize-none placeholder:text-gray-400 max-h-32"
                    style={{ minHeight: '24px' }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !pendingFile) || sending}
                  className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 mb-0.5">
                  {sending
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => setUploadOpen(false)}
        projetId={projetIdFromUrl}
      />
    </div>
  )
}
