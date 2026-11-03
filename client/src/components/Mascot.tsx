import { useId, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
gsap.registerPlugin(useGSAP)
export type CatState = 'idle' | 'read' | 'alert' | 'sleep' | 'celebrate' | 'peek'
export function MascotCat({
  state = 'idle',
  name = 'Mochi',
  level = 'auto',
  tip = 'Satu ide kecil layak dicatat.',
  small = false,
}: {
  state?: CatState
  name?: string
  level?: string
  tip?: string
  small?: boolean
}) {
  const unique = useId(),
    part = (key: string) => (small ? unique + '-' + key : key)
  const ref = useRef<HTMLButtonElement>(null),
    [bubble, setBubble] = useState(''),
    [visible, setVisible] = useState(!document.hidden),
    [reduced, setReduced] = useState(matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)'),
      change = () => setReduced(mq.matches),
      vis = () => setVisible(!document.hidden)
    mq.addEventListener('change', change)
    document.addEventListener('visibilitychange', vis)
    return () => {
      mq.removeEventListener('change', change)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])
  useEffect(() => {
    if (!bubble) return
    const t = setTimeout(() => setBubble(''), 4000)
    return () => clearTimeout(t)
  }, [bubble])
  const full = !reduced && (level === 'auto' || level === 'full')
  const { contextSafe } = useGSAP(
    () => {
      if (!visible || level === 'off') return
      if (small) {
        if (full && state === 'peek')
          gsap.fromTo(
            '.paw-right',
            { rotation: 0 },
            { rotation: -12, transformOrigin: '20% 90%', duration: 0.3, repeat: 1, yoyo: true },
          )
        return
      }
      const blink = gsap.timeline({ repeat: -1, repeatDelay: full ? 4.7 : 8 })
      if (state !== 'sleep')
        blink.to(
          '.eye-group',
          { scaleY: 0.12, transformOrigin: '50% 55%', duration: 0.1, yoyo: true, repeat: 1 },
          0.8,
        )
      if (!full) return
      if (bubble) {
        gsap.to('.cat-head', { rotation: -7, transformOrigin: '50% 85%', duration: 0.22 })
        return
      }
      gsap.to('.cat-body', {
        scaleY: 1.018,
        transformOrigin: '50% 92%',
        duration: state === 'sleep' ? 2.7 : 1.9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
      gsap.to('.cat-tail', {
        rotation: state === 'read' ? 2 : -6,
        transformOrigin: '15% 90%',
        duration: 2.1,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
      if (state === 'read')
        gsap.to('.cat-head', { rotation: 3, transformOrigin: '50% 90%', duration: 0.3 })
      if (state === 'celebrate') {
        gsap.to('.paw-right, .paw-left', { y: -5, duration: 0.25, repeat: 1, yoyo: true })

        gsap.fromTo(
          '.cat-body',
          { y: 0 },
          { y: -19, duration: 0.28, yoyo: true, repeat: 1, ease: 'power2.out' },
        )
        gsap.fromTo(
          '.confetti',
          { scale: 0, opacity: 1 },
          { scale: 1.5, opacity: 0, transformOrigin: '50% 65%', duration: 0.85 },
        )
      }
      if (state === 'peek')
        gsap.to('.paw-right', {
          rotation: -12,
          transformOrigin: '20% 90%',
          duration: 0.35,
          repeat: 3,
          yoyo: true,
        })
      if (state === 'sleep')
        gsap.to('.zzz', { y: -8, opacity: 0.3, duration: 2, repeat: -1, yoyo: true })
      if (state === 'alert')
        gsap.to('.cat-head', {
          rotation: 2,
          transformOrigin: '50% 85%',
          duration: 0.2,
          repeat: 3,
          yoyo: true,
          repeatDelay: 0.6,
        })
    },
    {
      scope: ref,
      dependencies: [state, bubble, visible, full, level, small],
      revertOnUpdate: true,
    },
  )
  const move = contextSafe((event: React.PointerEvent) => {
    if (state !== 'idle' || !full || !visible || event.pointerType !== 'mouse') return
    const r = ref.current!.getBoundingClientRect()
    gsap.to(ref.current!.querySelectorAll('.eye-group'), {
      x: Math.max(-2, Math.min(2, (event.clientX - r.x - r.width / 2) / 35)),
      duration: 0.2,
      overwrite: 'auto',
    })
  })
  return (
    <button
      ref={ref}
      className={'mascot' + (small ? ' mini' : '')}
      aria-label={'Sapa ' + name}
      type="button"
      onClick={() =>
        setBubble(
          bubble
            ? ''
            : [tip, 'Meong! Pelan-pelan, satu pertemuan dulu.'][Math.floor(Math.random() * 2)],
        )
      }
      onPointerMove={move}
    >
      <svg
        viewBox={small ? '98 20 178 145' : '0 0 365 255'}
        role="img"
        aria-label={name + ', kucing oranye di atas tumpukan buku'}
        fill="none"
        stroke="#211f19"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g aria-hidden="true">
          <path
            fill="#211f19"
            stroke="none"
            d="M40 235q25-9 145-8 129-2 153 4-38 11-181 13-80 0-117-9Z"
          />
          <path d="m58 204 179-21 61 27-178 30-62-21Z" fill="#8472d4" />
          <path d="m65 204 170-18 56 24-173 25-53-18Z" fill="#c1a6f2" />
          <path d="m117 222 173-23v12l-173 24q-7-6 0-13Z" fill="#fff7df" />
          <path d="m61 199 174-19 59 18-177 28-59-16Z" fill="#aa91ea" />
          <path d="m68 211 23 8m41 8 141-21" strokeWidth="1.8" />
          <path d="m81 180 171-13 48 16-1 14-172 22-47-20Z" fill="#279f99" />
          <path d="m130 198 166-19v15l-166 21q-5-8 0-17Z" fill="#fff7df" />
          <path d="m78 179 172-17 51 17-172 23-50-17Z" fill="#65d9c5" />
          <path d="m211 191 16-2v16l-8-3-7 6Z" fill="#ff776c" />
          <path d="m141 206 60-7m35-5 50-6" strokeWidth="1.6" />
        </g>
        <g id={part('cat-body')} className="cat-body">
          <g id={part('cat-tail')} className="cat-tail">
            <path
              d="M235 172q36 10 48-14 6-11-3-21-7-9-1-16 7-9 15-2 18 16 11 41-11 35-62 31Z"
              fill="#ffa25c"
            />
            <path d="M280 136q8 5 20 0m-15 15q10 5 19 1" stroke="#b85c38" strokeWidth="5" />
          </g>
          <path d="M140 145q-11 17-12 33-1 21 29 23l70-6q21-3 22-20 0-26-16-39Z" fill="#ffa25c" />
          <path d="M161 180q0-30 28-30 29 0 33 36-25 15-61 5Z" fill="#fff4df" stroke="none" />
          <g id={part('cat-head')} className="cat-head">
            <path
              d="M117 99q-8-27-4-65 2-14 12-10l39 24q19-7 42-4l36-23q11-6 13 10l3 49q16 18 16 42-1 39-57 49-47 9-86-7-32-12-31-37 0-15 17-28Z"
              fill="#ffa563"
            />
            <g id={part('cat-ear-l')}>
              <path d="M120 65q-4-12-2-32l27 20Z" fill="#f4a49b" strokeWidth="2.4" />
            </g>
            <g id={part('cat-ear-r')}>
              <path d="m224 50 23-20 3 33Z" fill="#f4a49b" strokeWidth="2.4" />
            </g>
            <path d="m158 50 9 12m6-15 8 12m7-13 6 10" stroke="#c87543" strokeWidth="6" />
            <path
              d="M103 123q28-8 40 8 10 16 39 12 30-4 42-22 11-14 44-16 8 28-15 43-25 18-66 21-45 4-69-11-17-9-15-35Z"
              fill="#fff1db"
              stroke="none"
            />
            <g id={part('cat-eyes')} className="eye-group">
              {state === 'sleep' ? (
                <path d="M133 108q7 9 15 0m58-8q7 9 15-1" />
              ) : (
                <>
                  <ellipse cx="144" cy="104" rx={state === 'alert' ? 6 : 5} ry="8" fill="#211f19" />
                  <ellipse cx="213" cy="98" rx={state === 'alert' ? 6 : 5} ry="8" fill="#211f19" />
                  <circle cx="145" cy="101" r="1.6" fill="#fff" stroke="none" />
                  <circle cx="214" cy="95" r="1.6" fill="#fff" stroke="none" />
                </>
              )}
            </g>
            <g id={part('cat-mouth')}>
              <path d="m168 115 13-1-6 7Z" fill="#df8075" strokeWidth="2.4" />
              <path d="M175 121q-1 10-10 8m10-8q3 9 12 5" strokeWidth="2.6" />
            </g>
            <path d="m113 118 13 3m-13 8 12-1m111-18 14-5m-13 14 14-1" strokeWidth="2.6" />
            <g stroke="#d98273" strokeWidth="3">
              <path d="m132 122 3-4m3 5 3-4m73-6 3-4m3 5 3-4" />
            </g>
            <g id={part('cat-glasses')} opacity={state === 'read' ? 1 : 0}>
              <path
                d="m123 91 34-3 2 16q0 13-13 14-17 2-19-10Zm75-7 34-3 2 16q0 13-13 14-17 2-19-10Z"
                fill="#d8eff5"
                fillOpacity=".43"
              />
              <path d="M159 93q19-11 40-5" />
            </g>
          </g>
          <g>
            <path d="M65 141q28-9 61 6 27-21 57-23l17 48q-38 4-64 30-38-19-67-14Z" fill="#ff756e" />
            <path
              d="M66 138q27-10 59 6 28-24 58-24l14 47q-38 7-62 29-38-20-62-12Z"
              fill="#fff5dc"
            />
            <path
              d="M60 143q32-4 66 13 24-24 60-28l14 47q-33 6-63 30-44-20-65-15Z"
              fill="#fc8075"
            />
            <path d="m126 156 10 47m-58-46 23 5m-21 2 18 4m51-6 25-14" strokeWidth="2.2" />
            <path d="m155 169 11-4" stroke="#fff2d8" strokeWidth="4" />
          </g>
          <g id={part('cat-paw-l')} className="paw-left">
            <path d="M112 140q11-7 18 1 6 7 0 13-11 9-19-2-3-5 1-12Z" fill="#fff0d7" />
            <path d="m117 147-2 4m9-6-1 5" strokeWidth="1.6" />
          </g>
          <g id={part('cat-paw-r')} className="paw-right">
            <path d="M183 145q7-7 16-3 13 7 9 17-5 10-19 5-15-5-6-19Z" fill="#fff0d7" />
            <path d="m188 151-3 4m9-2-3 4" strokeWidth="1.6" />
          </g>
        </g>
        <g
          id={part('cat-zzz')}
          className="zzz"
          opacity={state === 'sleep' ? 1 : 0}
          fill="#211f19"
          stroke="none"
          fontWeight="bold"
          fontSize="16"
        >
          <text x="276" y="68">
            z
          </text>
          <text x="287" y="55">
            Z
          </text>
        </g>
        <g className="confetti" opacity={state === 'celebrate' ? 1 : 0}>
          <path d="m34 62 8-4 4 8-8 4Z" fill="#ab8ce4" />
          <path d="m311 74 10 4-4 10-10-4Z" fill="#ff8174" />
          <path d="m80 37 4-8 5 8 8 2-7 5-1 7-5-5-8 2 4-7Z" fill="#ffe16a" />
        </g>
      </svg>
      {bubble && (
        <span id={part('cat-bubble')} className="cat-bubble" role="status">
          {bubble}
        </span>
      )}
    </button>
  )
}
export function Spark({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={'spark ' + className}
      viewBox="0 0 40 40"
      fill="currentColor"
      stroke="#211f19"
      strokeWidth="2.2"
      strokeLinejoin="round"
    >
      <path d="m20 2 4.5 12.5L37 20l-12.5 4.5L19 38l-4-13.5L2 19l13-4Z" />
    </svg>
  )
}
