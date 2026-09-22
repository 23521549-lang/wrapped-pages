# Món Quà Của Em

Web nhật ký riêng tư cho đúng hai người. Không đăng ký công khai: người mở đầu đặt biệt danh và một lời nhắn bí mật cho người kia, hệ thống tự sinh mật khẩu từ hai thứ đó, rồi người mở đầu gửi mật khẩu ấy cho người kia bằng kênh riêng. Người kia đăng nhập, rồi đặt tên lại cho người mở đầu để họ cũng có tài khoản. Từ đó về sau, mỗi người chỉ đổi được tên và lời nhắn bí mật của **người kia**, không tự đổi được của chính mình.

## Biến môi trường

Tạo file `.env.local` từ `.env.example` với hai biến sau:

- `DATABASE_URL`: chuỗi kết nối tới Postgres (dự án dùng Neon khi chạy thật). Toàn bộ dữ liệu của web nằm ở đây.
- `SERVER_KEY`: khoá bí mật của máy chủ, phải là một chuỗi ngẫu nhiên dài ít nhất 32 ký tự và **khác** chuỗi mẫu trong `.env.example`. Khoá này vừa dùng để sinh mọi mật khẩu (HMAC), vừa dùng để mã hoá mọi lời nhắn bí mật (AES-256-GCM). Xoay khoá này sau khi đã có dữ liệu sẽ làm hỏng vĩnh viễn mọi lời nhắn đã lưu và mọi mật khẩu đã sinh, nên đặt một lần và giữ nguyên.

Còn các biến kho tệp cho ảnh, ghi âm và bìa (năm biến `MEDIA_S3_*` và `MEDIA_LOCAL_DIR`), đều tùy chọn; xem `docs/huong-dan-kho-tep.md` để biết web làm gì khi không đặt (trên máy bạn thì lưu tệp vào một thư mục trên đĩa, trên Vercel thì phần media tắt). File `.env.local` không được commit.

## Lệnh chạy

```bash
npm install          # cài dependency
npm run dev           # chạy dev server
npm test              # test đơn vị (Vitest)
npm run test:e2e       # test đầu cuối (Playwright)
npm run db:generate    # sinh migration mới sau khi đổi schema Drizzle
npm run db:migrate     # áp migration lên database ở DATABASE_URL
npm run db:backup      # sao lưu database ra một tệp ngoài dự án
npm run db:restore -- <tệp> --xac-nhan  # khôi phục vào một database mới, trống
```

Sao lưu, cất tệp và khôi phục: xem `docs/huong-dan-sao-luu.md`.

## Deploy

Xem `docs/huong-dan-phat-hanh.md` để biết thứ tự deploy lần đầu, cách đặt `SERVER_KEY`, cách tự kiểm sau khi deploy, và việc cần làm khi một giá trị bí mật lỡ bị lộ.

## Test đầu cuối

`npm run test:e2e` dùng một database Postgres **riêng**, tên cố định `mqce_e2e`, trên cùng máy chủ với `DATABASE_URL`. Lần chạy đầu tiên, `globalSetup` tự tạo database này (nếu chưa có) và chạy migration thật lên đó - không đụng tới database ở `DATABASE_URL`.

Hàm `resetDb` (dọn sạch dữ liệu trước mỗi test) có một rào chặn: nó luôn kiểm tra tên database đang kết nối tới, và **từ chối chạy** nếu tên đó không đúng là `mqce_e2e`. Nhờ vậy một cấu hình sai không thể vô tình xoá sạch database thật.

## Thư viện bên thứ ba

- `heic-to` 1.5.2 (LGPL-3.0, https://github.com/hoppergee/heic-to): đọc ảnh HEIC, HEIF của iPhone ngay trong trình duyệt khi trình duyệt không tự đọc được. Dùng nguyên bản, không sửa, chỉ nạp thành một tệp JavaScript riêng khi người dùng chọn ảnh HEIC.
