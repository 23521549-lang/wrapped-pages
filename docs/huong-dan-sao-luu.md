# Hướng dẫn sao lưu và khôi phục database

Toàn bộ nhật ký (tài khoản, sách, từng trang đã viết, bản nháp, niêm phong, hoạt động) nằm trong **một** database Postgres trên Neon. Neon gói free không tự giữ bản sao lưu cho bạn lâu dài, và một dự án Neon lâu ngày không dùng có thể bị tạm dừng hoặc mất, phải khôi phục lại. Vì vậy hãy tự giữ bản sao lưu của mình.

Web có sẵn hai lệnh: một lệnh sao lưu, một lệnh khôi phục. Không cần cài thêm gì ngoài những thứ đã có để chạy web. Hai lệnh cần Node 22.18 trở lên (xem bằng `node -v`).

## Sao lưu: một lệnh

Ở thư mục dự án, chạy:

```bash
npm run db:backup
```

Lệnh này:

- đọc `DATABASE_URL` trong `.env.local` (giống `npm run db:migrate`), nên nó sao lưu đúng database mà web đang dùng;
- **chỉ đọc**, không bao giờ sửa hay xóa gì trong database; mọi bảng được chụp ở cùng một thời điểm, nên bản sao lưu luôn khớp với chính nó dù lúc đó có người đang viết;
- ghi ra một tệp `.json`, tên có ngày giờ (giờ UTC), ví dụ `mon-qua-cua-em_2026-09-18_14-03-59Z.json`;
- đọc lại tệp vừa ghi để kiểm tra, rồi in số hàng của từng bảng. Thấy dòng "Đã sao lưu xong vào: ..." là xong.

Lệnh không bao giờ in `DATABASE_URL` hay bất kỳ giá trị bí mật nào ra màn hình.

## Tệp sao lưu nằm ở đâu

Mặc định: thư mục `mon-qua-cua-em-sao-luu` nằm ngay trong thư mục người dùng của bạn, tức `C:\Users\<tên bạn>\mon-qua-cua-em-sao-luu` trên Windows (không nằm trong Documents). Lệnh tự tạo thư mục này nếu chưa có, và in đường dẫn đầy đủ của tệp mỗi lần sao lưu xong.

Mở nhanh trên Windows: mở File Explorer, bấm vào thanh địa chỉ ở trên cùng, dán `%USERPROFILE%\mon-qua-cua-em-sao-luu` rồi nhấn Enter.

Muốn để chỗ khác thì thêm một dòng vào `.env.local` (lệnh luôn đọc dòng này, kể cả khi `DATABASE_URL` được đặt ở chỗ khác):

```
BACKUP_DIR=D:\sao-luu-nhat-ky
```

Thư mục này **phải nằm ngoài thư mục dự án**. Lệnh từ chối ghi vào bên trong dự án, để tệp sao lưu không bao giờ lọt vào git.

Về OneDrive: thư mục mặc định ở trên **không** được OneDrive đồng bộ, vì OneDrive chỉ đồng bộ thư mục `OneDrive` của nó (cùng Documents, Desktop, Pictures nếu bạn đã bật sao lưu các thư mục đó). Nếu bạn đặt `BACKUP_DIR` vào bên trong một thư mục được đồng bộ như vậy, tệp sao lưu sẽ lên OneDrive của bạn; chỉ làm thế nếu bạn chấp nhận để toàn bộ nhật ký nằm trên đó.

## Vì sao phải cất tệp sao lưu thật cẩn thận

Tệp sao lưu chứa **mọi thứ** trong database, ở dạng đọc được:

- mọi trang đã viết, mọi bản nháp, kể cả sách riêng tư;
- câu hỏi và đáp án của các niêm phong;
- mã băm mật khẩu và lời nhắn bí mật đã mã hóa;
- phiên đăng nhập đang còn hạn.

Hãy cất nó như cất `SERVER_KEY`:

- chép sang một ổ USB hoặc ổ cứng rời, hoặc đính kèm vào trình quản lý mật khẩu;
- **không** để trong thư mục chia sẻ công khai hay thư mục đồng bộ mà người khác xem được;
- **không** gửi qua chỗ chat, email, hay dán lên bất kỳ đâu;
- không commit vào git.

## Không có SERVER_KEY cũ thì bản sao lưu không đủ

Lời nhắn bí mật trong database được mã hóa bằng `SERVER_KEY`, và mật khẩu cũng được sinh từ `SERVER_KEY`. Khôi phục vào một chỗ mới mà dùng `SERVER_KEY` khác thì hai người vẫn đăng nhập được bằng mật khẩu cũ (mã băm mật khẩu nằm trong bản sao lưu), nhưng không xem lại được lời nhắn bí mật và mật khẩu đã sinh, vì cả hai đều cần đúng `SERVER_KEY` cũ để giải mã hoặc tính lại. Phần còn lại (sách, trang) vẫn đọc được trong database, nhưng web sẽ không dùng được đúng như cũ.

Vì vậy: **giữ `SERVER_KEY` ở một nơi an toàn, tách khỏi tệp sao lưu** (ví dụ trình quản lý mật khẩu). Cần cả hai thứ mới khôi phục trọn vẹn được.

## Nên sao lưu bao lâu một lần

Gợi ý:

- **mỗi tuần một lần**;
- thêm một lần **ngay sau** khi viết xong một trang quan trọng;
- thêm một lần **trước và sau** mỗi lần cập nhật web có migration mới (lần sau là để bản sao lưu mới nhất luôn khớp với mã nguồn mới nhất, xem mục "Khi báo lệch migration" ở dưới).

Mỗi lần chạy tạo một tệp mới, không ghi đè tệp cũ. Giữ vài tệp gần nhất (ví dụ bốn tuần gần nhất, cộng mỗi tháng một tệp) rồi xóa bớt tệp cũ hơn.

## Ảnh, ghi âm và bìa KHÔNG nằm trong bản sao lưu

Database chỉ lưu thông tin về tệp (kích thước, loại, tên trong kho). Bản thân ảnh, đoạn ghi âm và bìa tự tải lên nằm ở kho tệp riêng (xem `docs/huong-dan-kho-tep.md`):

- nếu dùng Cloudflare R2 hoặc kho S3 khác: tệp nằm trên đó, không mất khi database mất. Đừng xóa bucket;
- nếu chạy trên máy với kho trên đĩa: tệp nằm trong thư mục `MEDIA_LOCAL_DIR` (không đặt thì là thư mục `mqce-media` trong thư mục tạm của máy). Muốn giữ thì tự chép thư mục đó đi.

Khôi phục database mà thiếu các tệp này thì chữ vẫn đủ, chỉ ảnh và ghi âm không hiện.

## Khôi phục vào một database mới

Chỉ khôi phục vào một database **mới tạo và còn trống**. Lệnh khôi phục tự kiểm tra và từ chối nếu database đã có dữ liệu, nên không thể ghi đè hay trộn lẫn với dữ liệu đang có. Toàn bộ chạy trong một giao dịch: lỗi ở bất kỳ bước nào thì database đích trở lại y như trước.

1. **Tạo database mới trên Neon.** Đăng nhập [console.neon.tech](https://console.neon.tech), tạo một dự án mới (hoặc một database mới trong dự án đang có). Chép chuỗi kết nối (connection string) của nó.
2. **Giữ lại chuỗi cũ.** Trong `.env.local`, chép dòng `DATABASE_URL` hiện tại ra một chỗ an toàn nếu còn cần.
3. **Trỏ `DATABASE_URL` sang database mới.** Sửa dòng `DATABASE_URL=` trong `.env.local` thành chuỗi vừa chép. `SERVER_KEY` giữ nguyên như cũ.
4. **Tắt web ở máy** nếu đang chạy (`npm run dev`), để không có gì ghi vào database mới trong lúc khôi phục.
5. **Tạo bảng:**

   ```bash
   npm run db:migrate
   ```

6. **Khôi phục** (thay đường dẫn bằng tệp của bạn, giữ dấu nháy nếu đường dẫn có khoảng trắng):

   ```bash
   npm run db:restore -- "C:\Users\<tên bạn>\mon-qua-cua-em-sao-luu\mon-qua-cua-em_2026-09-18_14-03-59Z.json" --xac-nhan
   ```

   Chữ `--xac-nhan` ở cuối là bắt buộc. Thiếu nó, lệnh chỉ nhắc bạn kiểm tra lại `DATABASE_URL` rồi dừng, không ghi gì. Lệnh in tên database nó đang ghi vào, rồi in số hàng từng bảng sau khi xong; số này phải khớp với số lúc sao lưu.
7. **Cập nhật Vercel.** Vào dự án trên Vercel, **Settings** rồi **Environment Variables**, sửa `DATABASE_URL` thành chuỗi mới, rồi **Redeploy**. `SERVER_KEY` trên Vercel giữ nguyên.
8. **Kiểm tra:** đăng nhập bằng mật khẩu cũ, mở vài cuốn sách, mở một lời nhắn bí mật.

### Khi lệnh báo lệch migration

Bản sao lưu ghi lại danh sách migration (các bước tạo bảng) mà database đã chạy lúc sao lưu. Lệnh khôi phục chỉ chịu khi database đích đã chạy **đúng y** danh sách đó, để dữ liệu vào đúng khuôn bảng. Mỗi migration được nhận ra bằng mốc thời gian của nó (giống cách `npm run db:migrate` nhận ra), nên clone lại mã nguồn trên máy khác, Windows hay không, không làm lệch.

- Báo database đích có **ít** migration hơn: bạn quên bước 5, hoặc mã nguồn đang cũ. Cập nhật mã nguồn rồi chạy lại `npm run db:migrate`.
- Báo database đích có **nhiều** migration hơn: bản sao lưu được tạo từ một phiên bản web cũ hơn mã nguồn hiện tại. Cách làm: tạo lại một database trống khác, đưa mã nguồn về đúng phiên bản lúc sao lưu (`git checkout <commit lúc đó>`), chạy `npm run db:migrate` rồi `npm run db:restore -- <tệp> --xac-nhan`; xong thì quay về bản mới nhất (`git checkout main`) và chạy `npm run db:migrate` lần nữa để nâng database lên. Nếu không chắc làm được, nhờ người biết lập trình giúp. Sao lưu ngay sau mỗi lần cập nhật web sẽ tránh được hẳn trường hợp này.
- Báo hai bên **khác nhau từ migration thứ ...**: bản sao lưu được tạo từ một nhánh mã nguồn khác với nhánh bạn đang có. Làm như trường hợp trên: tạo database trống khác, `git checkout` về đúng commit đã dùng lúc sao lưu, chạy `npm run db:migrate` rồi khôi phục.

Các thông báo khác của lệnh khôi phục đều nói rõ lý do bằng tiếng Việt và không bao giờ để database ở trạng thái ghi dở.

## Tính năng khôi phục của chính Neon

Neon có sẵn tính năng khôi phục về một thời điểm trước đó (mục **Restore** / lịch sử của nhánh trong bảng điều khiển Neon). Đây là lớp bảo vệ bổ sung tốt, ví dụ khi dữ liệu bị hỏng vài giờ trước. Nhưng:

- gói Free chỉ giữ lịch sử **6 giờ gần nhất** (tối đa 1 GB) và cho **1** bản chụp (snapshot) tạo tay, theo trang giá của Neon, tháng 9/2026. Lỗi phát hiện muộn hơn 6 giờ thì lịch sử này không cứu được;
- nếu cả dự án Neon bị mất thì lịch sử của nó cũng mất theo.

Vì vậy vẫn cần tệp sao lưu của riêng bạn, cất ngoài Neon.
