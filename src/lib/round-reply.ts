/**
 * Loi hoi dap theo luot dang: luat chu dung chung cho may chu (submitRoundReply) va man doc (bo dem), nen hai phia dem
 * cung mot cach. Ham thuan, khong cham trinh duyet hay database.
 */

/** Tran ky tu cua mot loi hoi dap, dem theo code point nhu char_length cua Postgres; khop CHECK round_replies_body (co test). */
export const REPLY_MAX = 1000;
