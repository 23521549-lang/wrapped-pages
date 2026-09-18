const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chuoi co dung dang UUID khong. Kiem truoc moi truy van, vi Postgres nem loi 22P02 khi ep chuoi rac sang uuid. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
