import JSZip from 'jszip'

export type DownloadableDoc = {
  storage_path: string | null
  nom_fichier: string
}

/**
 * Télécharge tous les documents passés en argument et les regroupe
 * dans un zip déclenché côté navigateur.
 *
 * @param docs       Liste des documents à inclure
 * @param zipName    Nom du fichier zip (sans extension)
 * @param getSignedUrl  Fonction qui retourne une URL signée à partir d'un storage_path
 * @param onProgress Callback de progression (n, total)
 */
export async function downloadFolderAsZip(
  docs: DownloadableDoc[],
  zipName: string,
  getSignedUrl: (storagePath: string) => Promise<string | null>,
  onProgress?: (current: number, total: number) => void,
): Promise<{ ok: boolean; error?: string }> {
  const filtered = docs.filter(d => d.storage_path)
  if (filtered.length === 0) return { ok: false, error: 'Aucun document à télécharger' }

  const zip = new JSZip()
  const usedNames = new Set<string>()

  for (let i = 0; i < filtered.length; i++) {
    const doc = filtered[i]
    onProgress?.(i, filtered.length)
    try {
      const url = await getSignedUrl(doc.storage_path!)
      if (!url) continue
      const res = await fetch(url)
      if (!res.ok) continue
      const blob = await res.blob()

      let name = doc.nom_fichier || `document-${i + 1}`
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf('.')
        const base = dot > 0 ? name.slice(0, dot) : name
        const ext = dot > 0 ? name.slice(dot) : ''
        let n = 2
        while (usedNames.has(`${base} (${n})${ext}`)) n++
        name = `${base} (${n})${ext}`
      }
      usedNames.add(name)

      zip.file(name, blob)
    } catch (e) {
      console.error('downloadFolderAsZip:', doc.nom_fichier, e)
    }
  }
  onProgress?.(filtered.length, filtered.length)

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${zipName}.zip`
  a.click()
  URL.revokeObjectURL(url)

  return { ok: true }
}
