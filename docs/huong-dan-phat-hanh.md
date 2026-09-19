# Hướng dẫn phát hành

Tài liệu này viết cho người giữ cuốn nhật ký, không phải cho lập trình viên. Đọc khi bạn đưa web lên một nơi
mới (ví dụ Vercel) lần đầu, khi đổi mật khẩu database, hoặc khi một giá trị bí mật lỡ bị lộ.

Biến môi trường của kho ảnh/ghi âm xem ở `docs/huong-dan-kho-tep.md`, tài liệu này không nhắc lại.

## Thứ tự lần đầu deploy

`next build` (và do đó lệnh `npm run build`) **không tự chạy migration**. Nếu web nhận lượt truy cập đầu
tiên trước khi migration chạy, nó chạy trên một schema rỗng: mọi thao tác chạm database (đăng nhập, mở
sách, ghi trang...) sẽ lỗi.

Làm đúng thứ tự như sau:

1. Tạo một database Postgres thật (dự án này dùng Neon), lấy chuỗi kết nối của nó.
2. Điền `DATABASE_URL` và `SERVER_KEY` (xem mục riêng bên dưới) cho môi trường mới, ở nơi bạn đang deploy
   (ví dụ mục Environment Variables của Vercel).
3. Chạy `npm run db:migrate` một lần, trỏ đúng vào `DATABASE_URL` của môi trường đó. Lệnh này áp toàn bộ
   migration đã có sẵn trong repo lên database, tạo hết bảng cần thiết.
4. Chỉ sau khi Bước 3 chạy xong mới cho web nhận lượt truy cập thật đầu tiên (bấm Deploy, hoặc mở domain
   công khai).

Từ khi có mục "Tự động deploy" bên dưới, Bước 3 và Bước 4 do GitHub Actions làm theo đúng thứ tự này mỗi
lần deploy. Bạn chỉ cần làm Bước 1, Bước 2 và phần cài đặt một lần của mục đó.

## Tự động deploy

Repo có hai quy trình tự động trên GitHub Actions (thư mục `.github/workflows`):

- **Kiểm thử** (`kiem-thu.yml`): chạy mỗi khi bạn push một nhánh khác `main` hoặc mở pull request vào `main`.
  Nó chạy lint, kiểm kiểu, test đơn vị và toàn bộ test đầu cuối trên một database Postgres tạm của riêng lần
  chạy đó, không chạm database thật.
- **Triển khai** (`trien-khai.yml`): chạy khi có commit mới vào `main`, hoặc khi bạn bấm nút thủ công. Thứ tự
  luôn là: kiểm thử xanh, sao lưu database (mã hóa), migrate database, rồi mới build và deploy lên Vercel.
  Kiểm thử đỏ thì không bước nào sau đó chạy.

Vercel tự deploy mỗi khi có push nếu repo nối với Vercel, và làm vậy trước bước migrate. Vì thế
`vercel.json` đã tắt việc tự deploy qua git: chỉ quy trình Triển khai mới deploy.

### Cài đặt một lần

1. **Tạo dự án trên Vercel.** Vào vercel.com, "Add New Project", chọn repo `wrapped-pages`. Framework là
   Next.js, để nguyên các lệnh build mặc định. Trong Settings của dự án, mục Node.js Version chọn 22.
2. **Đặt biến môi trường của web trên Vercel** (Settings, Environment Variables, môi trường Production):
   `DATABASE_URL` (chuỗi kết nối `neondb`, đuôi phải là `/neondb`), `SERVER_KEY` (đúng giá trị bạn đã cất,
   không tạo mới), và năm biến `MEDIA_S3_*` nếu đã có kho tệp (`docs/huong-dan-kho-tep.md`).
3. **Lấy mã tổ chức và mã dự án.** Trên máy, trong thư mục dự án, chạy `npx vercel link` và chọn đúng dự án
   vừa tạo. Lệnh tạo tệp `.vercel/project.json` chứa `orgId` và `projectId` (thư mục `.vercel` không được
   commit).
4. **Tạo token Vercel.** vercel.com, Account Settings, Tokens, tạo một token chỉ cho dự án này, đặt hạn dùng.
5. **Tạo environment `production` trên GitHub.** Repo, Settings, Environments, "New environment", đặt tên
   `production`. Nếu muốn mỗi lần deploy phải bấm duyệt, bật "Required reviewers" và chọn chính bạn.
6. **Đặt năm secrets cho environment đó.** Chạy từng lệnh dưới đây trong thư mục dự án; mỗi lệnh sẽ hỏi giá
   trị và không in giá trị ra màn hình. **Không dán các giá trị này vào chat hay bất kỳ đâu khác.**

   ```
   gh secret set VERCEL_TOKEN --env production
   gh secret set VERCEL_ORG_ID --env production
   gh secret set VERCEL_PROJECT_ID --env production
   gh secret set PROD_DATABASE_URL --env production
   gh secret set BACKUP_PASSPHRASE --env production
   ```

   `PROD_DATABASE_URL` là cùng chuỗi `DATABASE_URL` của `neondb`, dùng để migrate và sao lưu trước khi
   deploy. `BACKUP_PASSPHRASE` là một cụm mật khẩu dài bạn tự đặt để mã hóa bản sao lưu; cất nó cùng chỗ với
   `SERVER_KEY`, mất nó thì không mở được các bản sao lưu tự động.

### Deploy

- **Tự động:** merge hoặc push vào `main`. Xem tiến trình ở tab Actions của repo.
- **Thủ công:** tab Actions, chọn "Trien khai", bấm "Run workflow", chọn nhánh `main`.
- Chưa đặt đủ secrets thì quy trình dừng ngay ở bước đầu và nêu tên secret còn thiếu; không có gì bị thay đổi.

### Bản sao lưu tự động

Mỗi lần deploy tạo một bản sao lưu database trước khi migrate, mã hóa bằng `BACKUP_PASSPHRASE` và giữ 7 ngày
trong mục Artifacts của lần chạy đó. Muốn dùng: tải tệp `.gpg` về, giải mã bằng
`gpg --decrypt tep.json.gpg > tep.json` (nhập cụm mật khẩu), rồi khôi phục theo `docs/huong-dan-sao-luu.md`.
Bản sao lưu tự động không thay cho thói quen tự sao lưu định kỳ: nó chỉ giữ 7 ngày.

## `SERVER_KEY`: đặt một lần, giữ nguyên vĩnh viễn

`SERVER_KEY` làm hai việc cùng lúc:

- Sinh mọi mật khẩu đăng nhập (bằng HMAC).
- Mã hóa mọi lời nhắn bí mật đã lưu (bằng AES-256-GCM).

Xoay khóa này sau khi web đã có dữ liệu sẽ hỏng **không cứu được**: mọi lời nhắn bí mật đã lưu trở thành một
mớ bản mã không còn giải ra được, và mọi mật khẩu đã sinh từ khóa cũ ngừng dùng được. Không có cách phục hồi -
đây không phải lỗi kỹ thuật có thể sửa, mà là bản chất của mã hóa: mất khóa là mất dữ liệu.

Vì vậy:

- Đặt `SERVER_KEY` **một lần duy nhất**, lúc deploy lần đầu, bằng một chuỗi ngẫu nhiên dài ít nhất 32 ký tự
  và khác hẳn chuỗi mẫu trong `.env.example`. Web tự chặn từ lúc đọc biến: thiếu, ngắn hơn 32 ký tự, hoặc
  đúng bằng chuỗi mẫu thì web từ chối chạy và báo rõ lý do (xem `src/server/db/index.ts`).
- Sau đó không đổi giá trị này nữa, trừ trường hợp bất đắc dĩ nêu ở mục "khi một giá trị bí mật lỡ lộ" bên
  dưới - và ngay cả lúc đó, vẫn phải hiểu là đổi nó đồng nghĩa với mất sạch lời nhắn bí mật đã lưu.

## Tự kiểm sau khi deploy

Sau khi deploy xong (migration đã chạy ở bước trên), làm theo thứ tự sau. Web này chỉ có đúng hai chỗ
ngồi: người mở đầu đặt biệt danh và lời nhắn bí mật **cho người kia**, hệ thống sinh mật khẩu cho người kia
từ hai thứ đó; người kia đăng nhập bằng mật khẩu đó rồi đặt tên lại **cho người mở đầu** để người mở đầu
cũng có tài khoản. Không có bước "tạo sách rồi đăng xuất, đăng nhập lại bằng mật khẩu vừa tự sinh" cho người
mở đầu - mật khẩu người mở đầu tự tạo ra là mật khẩu **của người kia**, không phải của chính họ.

1. Mở domain công khai của web. Vì database rỗng, trang gốc (`/`) phải tự chuyển tới `/khoi-tao` (màn "Đặt
   tên"), không phải trang lỗi.
2. Đóng vai người mở đầu: điền "Biệt danh bạn đặt cho người kia" và "Lời nhắn bí mật gửi họ", bấm "Tạo tài
   khoản". Web chuyển tới `/khoi-tao/xong`, hiện mật khẩu kèm dòng "Gửi mật khẩu này cho người kia." Vì mới
   có một chỗ ngồi, màn hình còn ghi "Bạn chưa có tài khoản. Chờ người kia đặt tên lại cho bạn." - đúng vậy,
   người mở đầu chưa có tài khoản của mình. Chép lại mật khẩu vừa hiện.
3. Mở một cửa sổ ẩn danh (đóng vai người kia, tránh trùng cookie phiên/thiết bị với cửa sổ vừa dùng), vào
   `/dang-nhap`, dán mật khẩu vừa chép vào ô "Mật khẩu người kia gửi cho bạn", bấm "Vào". Đăng nhập được
   tức là `DATABASE_URL` và `SERVER_KEY` đều ổn: mật khẩu vừa sinh bằng HMAC(SERVER_KEY, ...) khớp đúng với
   bản ghi đã lưu trong database.
4. Đăng nhập xong, web tự đưa lại tới `/khoi-tao`, lần này là lượt đáp lễ: đặt biệt danh và lời nhắn bí mật
   cho người mở đầu, bấm "Tạo tài khoản". Màn "Đã xong" hiện mật khẩu của người mở đầu - gửi mật khẩu này
   cho họ. Vì giờ đã đủ hai chỗ ngồi, màn hình có thêm dòng "Giờ cả hai đã có tài khoản." và nút "Vào kệ
   sách".
5. Bấm "Vào kệ sách". Kệ còn trống nên nút "Tạo sách" nằm giữa màn; bấm nó, đặt tên, tạo một cuốn. Web đưa
   thẳng tới màn viết. Gõ thử vài chữ, đợi dòng trạng thái đổi thành "Đã lưu lúc ..." (web tự lưu sau khi
   bạn ngừng gõ), rồi tải lại trang: nội dung phải còn nguyên. Đây là kiểm database ghi/đọc được thật,
   không chỉ là web đứng lên.
6. Kiểm nhạc nền trên web thật. Mở cuốn vừa tạo từ kệ sách, bấm "Sửa sách", dán một link YouTube vào ô
   "Nhạc nền", bấm "Lưu". Mở lại cuốn đó từ kệ sách: bìa hiện kèm nút "Mở sách". Bấm "Mở sách" và nghe nhạc
   phát; dòng chữ trong thẻ "Nhạc nền" đổi thành "Nhạc đang phát". Đây là chỗ duy nhất trình phát YouTube
   thật chạy dưới chính sách bảo mật nội dung (Content-Security-Policy) của web: bộ kiểm thử tự động giả lập
   YouTube khi không có mạng nên không bao giờ nạp khung YouTube thật. Nếu nhạc không phát, mở công cụ nhà
   phát triển của trình duyệt (F12), vào tab Console và tìm dòng có chữ "Content Security Policy".
7. Nếu bạn có đặt biến kho ảnh (`MEDIA_S3_*`), làm tiếp Bước 6 của `docs/huong-dan-kho-tep.md` để kiểm riêng
   phần ảnh và ghi âm.

Nếu bước nào thất bại, mở log của nơi đang deploy (ví dụ Vercel) và đọc dòng lỗi đầu tiên: thông điệp lỗi
thường ghi rõ đang thiếu biến nào hoặc database từ chối vì sao. Trên trình duyệt, web không bao giờ in thông
điệp đó ra: khi một trang hỏng (hay gặp nhất là database không tới được), web hiện trang "Trang chưa mở được"
kèm nút "Thử lại", và nếu chỗ hỏng nằm ở máy chủ thì thêm một dòng "Mã lỗi: ..." - tìm đúng mã đó trong log
để ra dòng lỗi thật của lần hỏng ấy.

## Lỗi kết nối database thường gặp sau này

Neon (nơi lưu database) có gói free: một dự án lâu ngày không ai vào có thể bị tạm dừng. Khi đó lỗi
thường hiện theo đúng thứ tự dưới đây - biết trước thứ tự sẽ đỡ tốn thời gian đoán lỗi. Trên
web, cả hai lỗi dưới đây đều chỉ hiện thành trang "Trang chưa mở được"; câu lỗi nguyên văn nằm trong log:

1. **Lỗi "The requested endpoint could not be found, or you don't have access to it".** Nghĩa là Neon
   không tìm thấy endpoint của database. **Chưa chắc:** lý do chính xác (dự án bị tạm dừng do lâu ngày
   không dùng, hay một cơ chế khác của Neon) - điều biết chắc là mạng của bạn không có vấn đề gì, và endpoint
   tìm lại được sau khi khôi phục (restore) dự án trên Neon. Việc cần làm: đăng nhập Neon, tìm lại dự án,
   khôi phục nó. Sau khi khôi phục, thử lại - nếu vẫn lỗi nhưng lỗi đã đổi khác đi, xem bước 2.
2. **Lỗi "password authentication failed for user 'neondb_owner'" (hoặc tên role khác).** Nghĩa là endpoint
   đã tìm thấy được rồi, nhưng mật khẩu đang ghi trong `DATABASE_URL` không còn đúng nữa - mật khẩu đã đổi
   trong lúc hoặc sau khi khôi phục dự án. Việc cần làm: vào Neon, lấy lại chuỗi kết nối (connection string)
   mới của database, dán đè vào dòng `DATABASE_URL` (ở máy bạn và ở nơi deploy nếu cần), rồi thử lại. Chỉ
   một dòng này đổi là đủ, không cần dòng nào khác.

**Khi lấy chuỗi kết nối mới, xem kỹ tên database.** Dự án Neon có hai database: `neondb` là của web, còn
`mqce_e2e` là database kiểm thử mà bộ test tự tạo và xoá sạch mỗi lần chạy. Hộp "Connect" của Neon cho chọn
database, và chọn nhầm `mqce_e2e` là lỗi rất dễ mắc. Tên database nằm ở cuối chuỗi, giữa dấu
`/` cuối cùng và dấu `?`; nó phải là `/neondb`. Chọn nhầm thì `npm run db:backup` và bộ test e2e sẽ dừng lại
và báo rõ, nhưng web chạy trên máy thì không báo gì: nó dùng database kiểm thử như một database bình thường.

## Sao lưu

Database là nơi duy nhất giữ toàn bộ nhật ký, và gói Free của Neon chỉ giữ lịch sử 6 giờ gần nhất (tối đa 1 GB)
cùng 1 bản chụp (snapshot) tạo tay, theo trang giá của Neon, tháng 9/2026. Cách tạo
bản sao lưu và khôi phục từ nó ở `docs/huong-dan-sao-luu.md`.

## Khi một giá trị bí mật lỡ lộ

Xảy ra khi một chuỗi bí mật (mật khẩu database, khóa kho ảnh...) bị dán nhầm vào một cuộc trò chuyện, commit
nhầm vào git, hoặc gửi nhầm cho ai khác. Việc cần làm khác nhau theo từng loại giá trị:

- **Mật khẩu trong `DATABASE_URL`: xoay được, không mất gì.** Vào Neon, đổi (reset) mật khẩu của role đang
  dùng, dán mật khẩu mới vào `DATABASE_URL` ở máy bạn và ở nơi deploy (ví dụ Vercel), rồi deploy lại. Dữ
  liệu trong database không đụng chạm gì.
- **Năm biến `MEDIA_S3_*`: xoay được, không mất gì.** Tạo một token mới trong bảng điều khiển của nơi lưu
  trữ (ví dụ Cloudflare R2), điền năm biến bằng giá trị mới, deploy lại, rồi xóa token cũ. Tệp đã lưu vẫn
  còn nguyên, chỉ là đường truy cập đổi. Chi tiết từng biến ở `docs/huong-dan-kho-tep.md`.
- **`SERVER_KEY`: cần phân biệt hai tình huống.**
  - **Chỉ `SERVER_KEY` lộ, database không lộ theo:** thiệt hại trước mắt bị giới hạn. Theo
    `src/server/identity/password.ts` và `src/server/identity/recover.ts`, giải mã lời nhắn bí mật và tính
    lại mật khẩu cần **`SERVER_KEY` cùng với nội dung database** (lời nhắn đã mã hóa, biệt danh) - riêng cái
    khóa không giải mã được gì. Miễn database vẫn ở riêng tư thì người có mỗi `SERVER_KEY` chưa làm được gì.
    Việc cần làm: rà lại xem `DATABASE_URL` có bị lộ cùng lúc không; nếu có nghi ngờ, đổi (reset) mật khẩu
    của nó trên Neon như một bước phòng ngừa, dù bản thân `DATABASE_URL` không phải thứ vừa lộ.
  - **Cả `SERVER_KEY` lẫn database đều lộ:** đây là tình huống nặng thật sự, và chỉ chủ sở hữu mới quyết
    được. Giữ nguyên khóa thì người biết cả hai thứ tự giải được mọi lời nhắn bí mật đã lưu (vì chính khóa này đã
    dùng để mã hóa chúng) và tự tính được mật khẩu của cả hai người; đổi khóa thì bạn tự làm hỏng toàn bộ lời
    nhắn bí mật và mật khẩu đã sinh của chính mình, vĩnh viễn, để đổi lấy an toàn cho những gì lưu từ đó về
    sau. Cân nhắc giữa mất một chiều (lộ tiếp tục) và mất chiều kia (mất sạch dữ liệu cũ). Không có lựa chọn
    nào vừa giữ được dữ liệu cũ vừa đóng lại được lỗ hổng sau khi đã lộ.
