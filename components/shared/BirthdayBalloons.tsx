'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const BALLOON_COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF9FF3',
  '#FF9F43', '#48CAE4', '#B8F0A0', '#F8A5C2', '#FDCB6E',
  '#A29BFE', '#55EFC4',
]

function BalloonSVG({ color, width, height }: { color: string; width: number; height: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 60 90" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="30" cy="28" rx="22" ry="26" fill={color} />
      <ellipse cx="22" cy="18" rx="7" ry="9" fill="#fff" opacity="0.38" />
      <polygon points="30,54 27,60 33,60" fill={color} />
      <path d="M30 60 Q32 68 29 76 Q27 82 30 88" stroke="#bbb" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

interface BalloonData {
  id: number
  color: string
  x: number
  w: number
  h: number
  delay: number
  duration: number
  sway: number
}

export function BirthdayBalloons() {
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const [prenom, setPrenom] = useState('')
  const [balloons, setBalloons] = useState<BalloonData[]>([])
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function check(userId: string) {
      const sessionKey = `bday_v2_${userId}_${new Date().toISOString().slice(0, 10)}`
      if (sessionStorage.getItem(sessionKey)) return

      const { data } = await supabase
        .schema('app')
        .from('utilisateurs')
        .select('prenom,date_naissance')
        .eq('id', userId)
        .maybeSingle()

      if (!data?.date_naissance) return
      const dn = new Date(data.date_naissance)
      const today = new Date()
      if (dn.getMonth() !== today.getMonth() || dn.getDate() !== today.getDate()) return

      sessionStorage.setItem(sessionKey, '1')
      setPrenom(data.prenom ?? '')

      const generated: BalloonData[] = Array.from({ length: 30 }, (_, i) => {
        const w = 36 + Math.random() * 30
        return {
          id: i,
          color: BALLOON_COLORS[i % BALLOON_COLORS.length],
          x: Math.random() * 95,
          w,
          h: w * 1.5,
          delay: Math.random() * 2.2,
          duration: 3.2 + Math.random() * 2.5,
          sway: Math.random() * 80 - 40,
        }
      })
      setBalloons(generated)
      setVisible(true)
      setFading(false)

      const t1 = setTimeout(() => setFading(true), 4500)
      const t2 = setTimeout(() => {
        setVisible(false)
        setBalloons([])
        setFading(false)
      }, 6000)
      timersRef.current = [t1, t2]
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) check(session.user.id)
    })

    return () => {
      subscription.unsubscribe()
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  if (!visible) return null

  return (
    <>
      <style jsx global>{`
        @keyframes bdayFloat {
          0%   { transform: translateY(0) translateX(0); opacity: 1; }
          50%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(-110vh) translateX(var(--sway)); opacity: 0; }
        }
        @keyframes bdayMsgPop {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          overflow: 'hidden',
          transition: 'opacity 1.2s',
          opacity: fading ? 0 : 1,
        }}
      >
        {balloons.map(b => (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: `${b.x}%`,
              bottom: `-${b.h + 10}px`,
              width: `${b.w}px`,
              height: `${b.h}px`,
              animation: `bdayFloat ${b.duration}s ${b.delay}s linear forwards`,
              ['--sway' as string]: `${b.sway}px`,
            }}
          >
            <BalloonSVG color={b.color} width={b.w} height={b.h} />
          </div>
        ))}

        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: '20px',
            padding: '1.5rem 2.5rem',
            textAlign: 'center',
            boxShadow: '0 8px 40px rgba(80,60,180,0.25)',
            animation: 'bdayMsgPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
            zIndex: 10000,
            minWidth: '260px',
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px' }}>
            <path d="M20 21v-8a2 2 0 00-2-2H6a2 2 0 00-2 2v8" />
            <path d="M4 16s.5-1 4-1 4.5 2 8 1 4-1 4-1" />
            <path d="M2 21h20" />
            <path d="M7 8v3" /><path d="M12 8v3" /><path d="M17 8v3" />
            <path d="M7 4.5a1.5 1.5 0 010 3" /><path d="M7 4.5a1.5 1.5 0 000 3" />
            <path d="M12 4.5a1.5 1.5 0 010 3" /><path d="M12 4.5a1.5 1.5 0 000 3" />
            <path d="M17 4.5a1.5 1.5 0 010 3" /><path d="M17 4.5a1.5 1.5 0 000 3" />
          </svg>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#2d2550' }}>
            Joyeux anniversaire{prenom ? ` ${prenom}` : ''} !
          </div>
          <div style={{ fontSize: '14px', color: '#8880bb', marginTop: '4px' }}>
            Toute l'équipe API vous souhaite une belle journée
          </div>
        </div>
      </div>
    </>
  )
}
