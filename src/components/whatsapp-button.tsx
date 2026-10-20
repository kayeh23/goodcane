"use client";

export function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

/** A plain link to wa.me. Opens WhatsApp with a prefilled message; the person must press Send. */
export function WhatsAppLink({ href, children, onOpen, className = "", disabled }: { href: string; children: React.ReactNode; onOpen?: () => void; className?: string; disabled?: boolean }) {
  if (disabled)
    return (
      <span aria-disabled className={`btn cursor-not-allowed bg-[#25D366]/40 text-white ${className}`}>
        <WhatsAppIcon /> {children}
      </span>
    );
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={onOpen} className={`btn bg-[#25D366] text-[#073b1c] hover:bg-[#1fbe5b] ${className}`}>
      <WhatsAppIcon /> {children}
    </a>
  );
}
