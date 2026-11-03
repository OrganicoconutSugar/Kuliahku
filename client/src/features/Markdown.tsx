import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
export default function Markdown({ body }: { body: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
        img: ({ src, alt }) =>
          src?.startsWith('/api/files/') ? (
            <img src={src} alt={alt || 'Lampiran catatan'} loading="lazy" />
          ) : (
            <span>{alt || 'Gambar eksternal'}</span>
          ),
      }}
    >
      {body}
    </ReactMarkdown>
  )
}
