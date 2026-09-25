import type { ButtonHTMLAttributes, Ref } from "react";

export function Button({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button {...rest} className={className ? `btn ${className}` : "btn"}>
      {children}
    </button>
  );
}
