# Hướng dẫn tạo kho tệp cho ảnh, ghi âm và bìa

Web lưu ảnh, đoạn ghi âm và bìa tự tải lên vào một kho tệp chuẩn S3. Nhà cung cấp khuyến nghị là **Cloudflare R2**: gói free 10 GB, không tạm dừng khi lâu ngày không dùng, và không tính phí tải về.

Cần làm việc này một lần, rồi điền vài biến môi trường. Sau đó không phải đụng tới nữa.

## Trước tiên: có thể chưa cần làm gì

- **Chạy trên máy bạn:** không đặt biến nào thì web tự lưu tệp vào một thư mục trên đĩa. Viết, chèn ảnh, ghi âm, đặt bìa đều chạy đủ.
- **Chạy trên Vercel mà thiếu biến:** web vẫn chạy, chỉ là phần media tắt lặng lẽ. Nút "Thêm ảnh" và "Ghi âm" mờ đi kèm câu "Chưa bật kho lưu ảnh và ghi âm.", ô chọn ảnh làm bìa và nút "Đổi ảnh" không hiện (cuốn đã có bìa ảnh thì bìa đó vẫn hiện, vẫn đang chọn và vẫn được giữ khi sửa tên), và các trang đã có vẫn đọc được bình thường.
- Khi nào muốn hai người dùng thật trên Vercel, hãy làm các bước dưới.

## Bước 1: tạo bucket R2 riêng tư

1. Đăng nhập [dash.cloudflare.com](https://dash.cloudflare.com).
2. Vào mục **R2 Object Storage** ở cột trái, bấm **Create bucket**.
3. Đặt tên bucket, ví dụ `mon-qua-cua-em`. Tên chỉ gồm chữ thường, số và dấu gạch ngang.
4. Vị trí (Location) để **Automatic**.
5. Tạo xong, mở tab **Settings** của bucket và kiểm tra hai điều:
   - **Public access: Disabled**. Bucket phải luôn riêng tư. Web đọc tệp qua đường `/m/<id>` của chính nó và kiểm quyền từng lượt tải, nên không bao giờ cần đường công khai.
   - **Public Development URL** cũng để tắt.

**Chưa chắc:** khi bật R2 lần đầu, Cloudflare có thể hỏi thêm một phương thức thanh toán (thẻ) dù bạn chỉ dùng trong hạn mức free. Tài liệu bắt đầu của họ không ghi rõ điều này. Nếu bị hỏi mà bạn không muốn khai thẻ, xem mục "Dùng Supabase thay cho R2" ở cuối.

## Bước 2: tạo token API dạng S3 chỉ cho bucket đó

1. Trong mục **R2**, mở **API** rồi chọn **Manage API tokens** (có thể nằm ở góc phải trang R2).
2. Bấm **Create API token**.
3. Đặt tên gợi nhớ, ví dụ `mon-qua-cua-em-web`.
4. Quyền (Permissions): chọn **Object Read & Write**.
5. Phạm vi (Specify bucket): chọn **Apply to specific buckets only** rồi chọn đúng bucket vừa tạo. Đừng để token dùng được mọi bucket.
6. TTL để mặc định (không hết hạn) nếu bạn không muốn phải làm lại định kỳ.
7. Bấm tạo. Màn hình kết quả hiện **Access Key ID**, **Secret Access Key** và **endpoint** dạng `https://<account_id>.r2.cloudflarestorage.com`.
8. Chép cả ba giá trị ngay. Cloudflare chỉ hiện Secret Access Key một lần.

## Bước 3: dạng endpoint và region

- Endpoint là gốc tài khoản, **không kèm tên bucket**: `https://<account_id>.r2.cloudflarestorage.com`. Web tự ghép tên bucket vào đường dẫn.
- Region điền đúng chữ `auto`. R2 dùng `auto` cho mọi tài khoản.

## Bước 4: điền biến ở máy bạn

Mở file `.env.local` ở thư mục dự án (nếu chưa có thì chép từ `.env.example`), rồi điền năm biến sau. Mỗi biến một dòng, viết dạng `TEN_BIEN=giá trị`, không có dấu nháy và không có khoảng trắng quanh dấu bằng. Tên biến phải đúng từng chữ:

- `MEDIA_S3_ENDPOINT` là `https://<account_id>.r2.cloudflarestorage.com`, lấy ở Bước 2.
- `MEDIA_S3_REGION` là `auto`.
- `MEDIA_S3_BUCKET` là tên bucket ở Bước 1, ví dụ `mon-qua-cua-em`.
- `MEDIA_S3_ACCESS_KEY_ID` là Access Key ID ở Bước 2.
- `MEDIA_S3_SECRET_ACCESS_KEY` là Secret Access Key ở Bước 2.

Có thêm một biến tùy chọn, `MEDIA_LOCAL_DIR`, chỉ dùng khi bạn muốn kho trên đĩa nằm ở một thư mục cố định. Dùng S3 thì để trống.

Ba điều cần nhớ:
- **Điền đủ cả năm dòng.** Thiếu một dòng thì web dừng lại và báo đúng tên biến còn thiếu, chứ không lặng lẽ quay về lưu trên đĩa. Như vậy để không bao giờ mất ảnh vì quên một khóa.
- **Không bao giờ commit `.env.local`.** File này đã nằm trong `.gitignore`; đừng chép nội dung của nó vào bất kỳ file nào khác, cũng đừng dán vào chỗ chat.
- Muốn quay lại lưu trên đĩa thì xóa giá trị của cả năm dòng, để trống.

## Bước 5: thêm biến trên Vercel

1. Mở [vercel.com](https://vercel.com), vào dự án, chọn **Settings** rồi **Environment Variables**.
2. Thêm lần lượt năm biến ở trên, mỗi biến một dòng, giá trị dán từ Bước 2 và 3.
3. Chọn đủ ba môi trường **Production**, **Preview** và **Development** nếu bạn muốn bản xem trước cũng dùng được ảnh.
4. Lưu xong phải **Redeploy** một lần: biến môi trường chỉ vào bản dựng mới.

## Bước 6: kiểm tra

Trên bản vừa deploy (hoặc chạy `npm run dev` ở máy):

1. Mở một cuốn sách, bấm **Viết tiếp**.
2. Nút "Thêm ảnh" và "Ghi âm" phải bấm được, và không còn câu "Chưa bật kho lưu ảnh và ghi âm.".
3. Chèn một tấm ảnh nhỏ. Ảnh hiện ngay trong trang là đã tải lên xong.
4. Đăng trang rồi mở màn đọc, ảnh vẫn hiện. Bấm chuột phải vào ảnh, chọn xem địa chỉ ảnh: địa chỉ phải có dạng `/m/<id>` của chính web, không phải địa chỉ của Cloudflare.
5. Mở bảng R2 trên Cloudflare, vào bucket: phải thấy một object mới, tên dạng `<id sách>/<id media>.webp`. Đó là đúng cho ảnh chèn trong trang; bìa chọn ngay lúc **tạo sách mới** (trước khi sách có id) thì nằm trong thư mục `cho/` thay vì `<id sách>/`, còn một đoạn ghi âm thì đuôi tên là `.webm` chứ không phải `.webp`. Tìm không thấy đúng chỗ đang ngờ thì thử hai dạng tên này trước khi coi là lỗi.
6. Vào **Sửa sách**, chọn ô "Ảnh của bạn", cắt và lưu: bìa mới hiện trên kệ.

Nếu ảnh không hiện: mở lại Bước 4, soát từng tên biến, rồi xem log của Vercel. Web chỉ báo tên biến sai hoặc thiếu, không bao giờ in giá trị ra log.

## Dùng Supabase thay cho R2

Supabase Storage cũng có cổng S3, nên chỉ cần đổi hai biến:

- `MEDIA_S3_ENDPOINT=https://<project_ref>.supabase.co/storage/v1/s3`
- `MEDIA_S3_REGION=` điền đúng region của project (ví dụ `ap-southeast-1`), xem ở Settings.

Khóa lấy ở **Project Settings > Storage > S3 access keys**, bucket tạo ở mục **Storage** và phải để **Private**. Endpoint của Supabase có phần đuôi `/storage/v1/s3`; web giữ nguyên phần đuôi đó, nên cứ dán đúng địa chỉ Supabase đưa.

**Chưa chắc: AWS S3.** Web đặt tên object theo kiểu đường dẫn `{endpoint}/{bucket}/{key}`. R2 và cổng S3 của Supabase đều nhận kiểu này, nhưng AWS đã thông báo ngừng nhận nó cho bucket mới, nên dùng AWS S3 có thể không chạy.

Lưu ý vì sao dự án không khuyến nghị cách này: trang giá của Supabase ghi "Free projects are paused after 1 week of inactivity". Database của web nằm ở Neon, nên project Supabase chỉ giữ tệp và sẽ bị tạm dừng mỗi khi hai người không mở nhật ký một tuần. Khi đó ảnh, ghi âm và bìa đứt cho tới lúc có người vào khôi phục project.

Đổi nhà cung cấp về sau chỉ là đổi năm biến này, không phải sửa dòng code nào. Tệp cũ thì chép sang bucket mới giữ nguyên đường dẫn là xong.
