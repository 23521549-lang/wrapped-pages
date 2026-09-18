import type { InputHTMLAttributes } from "react";

/**
 * O nhap co nhan boc ngoai (getByLabel cua e2e van tim duoc), dung lop .field, .field__label, .input cua form
 * sach. Field tu dat lop .input, nen kieu prop khong nhan className: truyen vao se bi bo qua trong im lang.
 */
export function Field({ label, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & { label: string }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input {...rest} className="input" />
    </label>
  );
}
