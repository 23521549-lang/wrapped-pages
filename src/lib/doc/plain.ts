/**
 * Ep mot gia tri JSON (tai lieu, hay mang cac tai lieu) ve JSON THUAN truoc khi no roi trinh duyet di
 * toi mot Server Action.
 *
 * Vi sao can ham nay: attrs cua moi node ProseMirror duoc computeAttrs() dung "Object.create(null)"
 * (xem node_modules/prosemirror-model, ham _computeAttrs) - do la mot doi tuong KHONG co prototype.
 * Node.prototype.toJSON() gan thang obj.attrs = this.attrs (khong sao chep gia tri), nen editor.getJSON()
 * va node.toJSON() deu tra ve nguyen doi tuong khong-prototype do trong cay JSON. Bo ma hoa doi so cho
 * Server Function cua Next.js (react-server-dom-webpack) coi mot doi tuong khong-prototype la khong hop
 * le; vi Next co cau hinh san mot tap temporaryReferences cho moi loi goi Server Action tu client, no
 * KHONG nem loi ma am tham thay ca gia tri bang chuoi rong "$T" - khong kem du lieu that nao di theo. May
 * chu vi vay nhan dung chuoi "$T" lam attrs, that bai kiem cua cleanMedia (isObj(node.attrs)) va tu choi
 * ca tai lieu voi thong diep chung "noi dung khong doc duoc", du nguoi dung go hoan toan dung.
 *
 * Doan chu thuan (doan, chu, dam/nghieng/gach chan, danh sach, trich dan) KHONG dinh loi nay: cac
 * node/mark do khong khai bao addAttributes nao, nen vong for...in ben trong toJSON() khong bao gio gan
 * khoa "attrs" vao JSON cua chung (xem tests/unit/editor-schema.test.ts - schema chi "anh" va "ghi-am"
 * co attrs). Chi hai khoi media do, khi co mat trong tai lieu, moi mang doi tuong khong-prototype nay ra
 * ngoai bien Server Action.
 *
 * Chon JSON.parse(JSON.stringify(...)) thay vi structuredClone hay tu dung lai cay: round-trip qua JSON
 * khong chi bo prototype, no CHUNG MINH ca gia tri la JSON hop le - dung dieu kien ma bien Server Action
 * that su doi hoi. structuredClone se giu nguyen prototype null cua doi tuong (van dinh loi nay), con tu
 * dung lai cay (rebuild tay) thi de sot mot nhanh moi neu sau nay them loai node hay thuoc tinh khac.
 */
export function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
