type IconProps = {
  name: "heart" | "gem" | "truck" | "arrow" | "star" | "sparkles" | "bag" | "whatsapp";
  className?: string;
};

const Icon = ({ name, className }: IconProps) => {
  if (name === "heart") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M12 21s-7-4.4-9.2-8.4C.8 9.2 3 5.5 6.8 5.5c2.2 0 3.6 1.2 5.2 3.1 1.6-1.9 3-3.1 5.2-3.1 3.8 0 6 3.7 4 7.1C19 16.6 12 21 12 21z" />
      </svg>
    );
  }
  if (name === "gem") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M4 9l4-5h8l4 5-8 11L4 9zm4-3L6 9h12l-2-3H8z" />
      </svg>
    );
  }
  if (name === "truck") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M2 6h11v9H2V6zm11 2h4l3 3v4h-2a2.5 2.5 0 1 1-5 0h-2a2.5 2.5 0 1 1-5 0H4" />
      </svg>
    );
  }
  if (name === "arrow") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M18 12H6M12 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === "star") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M12 3l2.8 5.6 6.2.9-4.5 4.4 1.1 6.2L12 17.5 6.4 20l1.1-6.2L3 9.5l6.2-.9L12 3z" />
      </svg>
    );
  }
  if (name === "sparkles") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M12 2l1.4 3.6L17 7l-3.6 1.4L12 12l-1.4-3.6L7 7l3.6-1.4L12 2zm7 11l.9 2.1L22 16l-2.1.9L19 19l-.9-2.1L16 16l2.1-.9L19 13zM5 13l1.1 2.8L9 17l-2.9 1.2L5 21l-1.1-2.8L1 17l2.9-1.2L5 13z" />
      </svg>
    );
  }
  if (name === "bag") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M6 8h12l-1 12H7L6 8zm3 0a3 3 0 1 1 6 0" fill="none" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M20 11.5a8 8 0 1 1-14.5-4.6A8 8 0 0 1 20 11.5Z" />
      <path d="M6.8 20.6 4 21.3l.7-2.6" />
      <path d="M9.2 8.8c.2-.4.4-.4.7-.3l1 .5c.2.1.3.3.3.6 0 .4-.4 1-.6 1.2-.2.2-.2.4 0 .7.2.4 1.1 1.5 2.3 2 .3.1.5.1.7-.1.2-.2.7-.8 1.1-1 .3-.1.5 0 .7.1l1 .5c.3.1.5.3.5.6 0 .7-.4 1.5-1 1.9-.5.4-1.3.6-2.1.4-1.2-.3-2.3-1-3.2-1.8-.9-.8-1.6-1.7-2.1-2.8-.5-1.1-.4-2.2-.1-2.5Z" />
    </svg>
  );
};

export default Icon;
