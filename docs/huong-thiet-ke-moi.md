# Hướng thiết kế mới

Tài liệu này ghi lại các quyết định giao diện đang áp dụng, bắt đầu từ màn Kệ sách. Các màn khác khi được vẽ lại sẽ theo đúng những quy tắc ở đây. Mọi giá trị màu, bóng, bán kính đều nằm trong `src/styles/tokens.css`; CSS của từng thành phần chỉ gọi token, không viết màu trực tiếp (có bài kiểm `tests/unit/css-tokens.test.ts`).

## 1. Token mới

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--radius-nut` | `8px` | Cả ba cấp nút |
| `--ke-mep` | `oklch(91.5% 0.012 75)` | Vạch mép kệ, xám ấm rất nhạt, dày 1px |
| `--ke-mep-bong` | `oklch(96.5% 0.007 75)` | Bóng mềm ngay dưới mép kệ, ngắn 4px |
| `--radius-sach` | `2px 5px 5px 2px` | Góc bìa sách trên kệ: gáy vuông hơn mép ngoài |
| `--gay-sach-pha` | `90%` | Gáy sách = màu nền dưới của chính bìa pha 10% mực |
| `--gay-sach-sang` | `oklch(99.4% 0.005 235 / .45)` | Vệt sáng 1px ngay cạnh gáy |
| `--bong-rut-sach` | `0 14px 18px -12px oklch(24% 0.012 250 / .3)` | Bóng khi cuốn sách được rút ra khỏi kệ |
| `--radius-sach-mo` | `6px` | Mép ngoài của cuốn sách mở |
| `--bong-giay` | bốn lớp rất mỏng: viền 6%, 1px 4%, 6px 8%, 24px 20% (màu mực) | Bóng của cuốn sách mở |
| `--nep-bong` | `oklch(24% 0.012 250 / .04)` | Bóng gáy giữa hai trang, rộng 22px mỗi bên |
| `--nep-bong-hep` | `oklch(24% 0.012 250 / .045)` | Bóng gáy bên trái khi chỉ còn một tờ |
| `--nep-vach` | `oklch(24% 0.012 250 / .08)` | Nếp gấp 1px ở giữa, mờ dần hai đầu |
| `--radius-tranh` | `2px` | Tờ giấy của tranh dán |
| `--bong-tranh` | ba lớp mỏng: viền 7%, 1px 6%, 10px 28% | Bóng của tranh dán |
| `--tranh-nghieng` | `-1.8deg` | Góc nghiêng của tranh dán |

Bảng màu gốc (`--color-paper`, `--blue-*`, `--color-ink*`, `--color-focus`...) giữ nguyên. Cổng tương phản `tests/unit/tuong-phan.test.ts` vẫn là trọng tài: chữ thường từ 4.5, viền và vòng focus từ 3, không bao giờ hạ ngưỡng để cho qua.

## 2. Ba cấp nút

Cả ba cấp dùng chung: chữ Be Vietnam Pro 600, cỡ `--text-sm`, bán kính `--radius-nut`, vùng bấm tối thiểu 44px, không nhấc lên khi rê chuột. Vòng focus mặc định vẫn là điểm đậm màu duy nhất trên trang, không cấp nào được tắt `outline`.

| Cấp | Lớp | Hình dáng | Khi nào dùng |
|---|---|---|---|
| Chính | `.btn` | Nền `--blue-2`, viền `--blue-line`, chữ `--blue-ink`; rê chuột thì nền `--blue-3` | Hành động quan trọng nhất của màn. Mỗi màn chỉ nên có một nút cấp này. |
| Viền | `.btn--quiet` (và `.btn--line`, cùng một kiểu) | Nền trong suốt, viền mảnh `--color-rule-ui`, chữ mực; rê chuột thì nền `--color-paper-2` | Hành động phụ nhưng vẫn cần thấy rõ: "Sách mới", "Để sau", "Huỷ". |
| Chữ | `.btn--chu` | Chỉ là chữ đậm màu mực, gạch chân hiện khi rê chuột | Hành động luôn có mặt nhưng không được tranh chỗ với nội dung, ví dụ "Trang mới" trên thanh điều hướng. |

`.btn--sm` và `.btn--icon` vẫn ghép được với cả ba cấp.

## 3. Thanh điều hướng

- Nền thanh là `--nav-nen` (`oklch(95.5% 0.024 236)`), một màu xanh nước nhạt đặc, không trong suốt, sát mép trên của trang.
- Không có nền viên thuốc cho mục nào. Mục đang ở là chữ màu mực, đậm 600, kèm một gạch 2px màu mực đè lên vạch dưới của thanh. Các mục khác là chữ `--color-ink-2`.
- Người đang vào hiện bằng chữ: "Đang vào: **tên**". Không có ô tròn chữ cái. Từ 600px trở xuống dòng này ẩn đi.
- "Trang mới" là nút cấp chữ.
- Logo "sách thắt nơ" (`src/components/Logo.tsx`) đứng trước tên web, cao 30px, màu `--blue-ink`, dùng bộ lọc mực nhẹ `#muc-logo`. Biểu tượng tab (`src/app/icon.svg`) là cùng hình với nét dày hơn và không có bộ lọc để vẫn rõ ở 16px.
- Từ 700px trở xuống, ba liên kết xuống hàng riêng dưới tên web, mỗi liên kết cao 44px.
- Giữ nguyên: `aria-current="page"` cho màn đang ở, `"true"` cho màn con; thanh dính đầu trang trừ khi `sticky={false}` (màn viết, màn đọc có nhạc: thanh không bao giờ đè lên trình phát YouTube).

## 4. Giấy và cuốn sách mở

Cuốn sách mở trên kệ ("X vừa viết") dùng cùng chất liệu với tờ giấy của màn đọc (`giay.css`), nhẹ tay hơn:

- Nền `--color-giay`, bóng `--bong-giay`, bo `--radius-sach-mo` ở mép ngoài.
- Tỉ lệ 4:3, tức hai tờ 360×540 của màn đọc đặt cạnh nhau. Nếp gáy là vạch 1px `--nep-vach` mờ dần hai đầu, cộng bóng `--nep-bong` rộng 22px mỗi bên.
- Trang trái: "**Tên** vừa viết" (hoặc "**Bạn** vừa viết"), tên sách Lexend 600 cỡ `--text-md` (tối đa 2 dòng), dòng "N trang, thời điểm", bìa thật của cuốn đó dán như tranh in, và một nút chính duy nhất sát chân trang: "Viết tiếp" nếu là sách của mình, "Đọc tiếp" nếu là sách người kia.
- Tranh dán: bìa (tranh vẽ hoặc ảnh tự tải lên) in trên một tờ `--color-paper` có lề 6px, bóng `--bong-tranh`, nghiêng `--tranh-nghieng`, nằm chính giữa trang trái theo chiều dọc (cách đều mép trên và mép dưới của trang).
- Trang phải: đoạn trích bằng Be Vietnam Pro 400, cỡ 1.0625rem, giãn dòng 1.75, tối đa 34ch, tối đa 6 dòng; số tờ cuối ở giữa chân trang.
- Từ 640px trở xuống chỉ còn một tờ tỉ lệ 2:3 như tờ đơn của màn đọc: đoạn trích lên trước, rồi ai viết, tên, dòng phụ, tranh (không còn căn giữa), nút. Bóng gáy chỉ còn một dải 14px bên trái.

Ba trạng thái của trang phải:

- **Đang mở**: đoạn trích thường.
- **Riêng tư** (chỉ có thể là sách của chính người xem): đoạn trích làm mờ, ẩn với trình đọc màn hình, nhãn "Riêng tư, Mở sách để đọc" nằm giữa trang.
- **Tờ cuối đang khóa**: chỉ có dòng hé lộ người viết đã chọn (nếu có), rồi các vạch nhòe trang trí giống tờ khóa ở màn đọc, rồi nhãn khóa "Trang khóa, vượt thử thách để đọc". Chữ thật của trang khóa không bao giờ có trong trang, kể cả dạng ẩn. Trạng thái khóa đứng trước trạng thái riêng tư.

## 5. Kệ và cuốn sách trên kệ

- Đầu màn: "Kệ sách", dòng đếm "N cuốn, M trang mới" (phần trang mới chỉ có khi M > 0), nút viền "Sách mới".
- Dưới cuốn sách mở là hai ngăn: "Kệ của bạn" và "Kệ của <biệt danh người kia>", mỗi ngăn kèm số cuốn. Thứ tự sách giữ đúng thứ tự máy chủ trả (trang đăng gần nhất trước). Ngăn trống có một dòng chữ và một mép kệ.
- Mỗi cuốn: bìa 5:3 góc `--radius-sach`, gáy 6px (màu nền dưới của chính bìa pha 10% mực) cùng vệt sáng 1px, vẽ bằng lớp phủ riêng nên nằm trên cả ảnh bìa tự tải lên.
- Mép kệ chạy hết hàng: vạch 1px `--ke-mep` và bóng mềm 4px `--ke-mep-bong`, nằm giữa bìa và chữ.
- Dưới mép kệ: tên sách (tối đa 2 dòng), dòng "N trang, thời điểm" hoặc "Chưa có trang, thời điểm", rồi các dấu hiệu trạng thái.
- Cả cuốn là một liên kết tới màn đọc, nên vùng bấm là toàn bộ cuốn sách và vòng focus bao quanh cả cuốn.
- Màn rộng tự chia cột (mỗi cột tối thiểu 200px); từ 420px trở xuống luôn 2 cuốn mỗi hàng.

## 6. Dấu hiệu trạng thái

Dấu hiệu không phải nút, nên trông khác hẳn nút: không nền, không viền, không bo tròn. Mỗi dấu hiệu là một ký hiệu nhỏ 12px kèm chữ.

| Dấu hiệu | Hình | Chữ |
|---|---|---|
| Trang mới | chấm tròn 7px `--blue-mark` | "N trang mới", đậm, màu `--blue-ink` |
| Trang khóa | ổ khóa | "N trang khóa", màu `--color-ink-2` |
| Riêng tư | mắt gạch chéo | "Riêng tư", màu `--color-ink-2` |

Chú giải ở chân kệ dùng đúng ba ký hiệu này. Chân kệ không có dòng tên web hay năm.

## 7. Bìa và mực loang

Mười tranh bìa (núi xa, khóm trúc, trăng trên nước, chim bay qua bờ nước, và sáu tranh sau: cành hoa đào, đôi chim sẻ trên cành, thuyền nhỏ dưới trăng, cầu gỗ qua suối, đồi thông trong sương, mèo ngủ trên mái ngói) được vẽ bằng nét cố tình không đều, và đi qua một bộ lọc SVG chung `#muc-loang`:

1. `feTurbulence` tần số thấp xô dịch nét vẽ vài pixel (`feDisplacementMap`, scale 9);
2. `feGaussianBlur` rất nhẹ (0.9) cho mép nét ăn vào giấy;
3. một lớp nhiễu tần số thấp thứ hai làm mực thấm không đều thành vệt loang lớn.

Bộ lọc được khai **một lần** trong layout gốc (`InkDefs` trong `src/components/book/CoverArt.tsx`), mỗi bìa chỉ trỏ tới nó bằng id, nên không có id trùng. Bộ lọc SVG nội tuyến không cần thêm miền nào vào CSP. Ảnh bìa tự tải lên (`CoverImage`) không đi qua bộ lọc.

Nền giấy của mỗi bìa là một cặp token trong `tokens.css` (`--bia-nui-tren`, `--bia-nui-duoi`, ...), cùng dải sáng để mực vẫn nhạt và không bìa nào thành mảng đậm. Trong `app.css` mỗi bìa chỉ có **một** quy tắc, đặt hai biến `--bia-tren` và `--bia-duoi` từ cặp token của nó. Một quy tắc chung vẽ nền `linear-gradient(var(--bia-tren), var(--bia-duoi))` cho cả mười bìa, và gáy sách trên kệ pha màu từ `--bia-duoi`. Nhờ vậy kệ, cuốn sách mở, ô chọn bìa, bản nháp, ô xem trước và khung trống đều đọc cùng hai biến; thêm một bìa là thêm một cặp token và một dòng CSS.

## 8. Cột Hoạt động

- Không bo góc, không bóng: chỉ hai vạch mảnh `--color-rule` ở trên và ở dưới. Tiêu đề nhỏ: Be Vietnam Pro 600, cỡ `--text-sm`.
- Không có ảnh đại diện: tên người làm ("Bạn" hoặc biệt danh) in đậm ở đầu câu.
- Nhãn phụ trong một dòng (loại niêm phong, số lần thử) là dấu hiệu trạng thái: chữ cỡ `--text-xs`, không nền, không bo tròn.
- Khi chưa có tin: chỉ một dòng chữ đậm "Chưa có gì mới" và một câu hướng dẫn, không đóng khung.
- Màn rộng (trên 900px): cột cao đúng bằng cuốn sách mở bên cạnh. Cách làm: lưới kéo giãn cả hàng, cột đặt `height: 0; min-height: 100%` nên không bao giờ tự kéo dài hàng; dài hơn thì cuộn bên trong.
- Màn hẹp (từ 900px trở xuống), hoặc khi chưa có cuốn sách mở: cao tối đa 340px.
- Giữ nguyên: ẩn thanh cuộn nhưng có vệt mờ ở đáy, vùng cuộn nhận Tab (`tabindex="0"`, vai trò vùng, có nhãn), tiêu đề ngày dính mép trên, không cuộn ngang.

## 9. Chuyển động và vi tương tác

Chỉ có hai vi tương tác trên kệ, cả hai do người dùng kích hoạt và chỉ dùng `transform`:

- **Rút sách**: rê chuột hoặc focus vào một cuốn thì bìa nhích lên 6px và xoay nhẹ quanh gáy (`rotateY(-6deg)`), 220ms, `--ease-out`, kèm bóng `--bong-rut-sach`.
- **Tranh dán đặt thẳng**: rê chuột hoặc focus vào cuốn sách mở thì tranh dán xoay từ `--tranh-nghieng` về 0.

Với `prefers-reduced-motion: reduce`: sách không rút ra (chỉ còn bóng đổi màu 150ms), tranh dán giữ nguyên góc nghiêng. Không thêm hiệu ứng tự chạy, không hiện dần từng khối khi cuộn.

## 10. Chữ trên giao diện

- Nối các phần của một dòng phụ bằng dấu phẩy: "3 trang, hôm qua", "4 cuốn, 2 trang mới". Không dùng dấu chấm giữa.
- Không dùng dấu gạch dài ở bất cứ đâu.
- Tiêu đề tĩnh viết thẳng trong mã tối đa 20 ký tự. Không in nghiêng trong tiêu đề.
- Nhấn mạnh bằng chữ đậm trên nền nhạt, không bằng mảng màu đậm.

## 11. Đăng trang và niêm phong (màn viết)

Bấm "Đăng trang" không còn mở hộp trong thanh trên. Nút đó ẩn đi, đầu màn viết được kéo lên đỉnh cửa sổ, và phần dưới thanh trên (tên sách, thanh công cụ vẫn giữ nguyên) chia thành ba cột vừa đúng một màn, không cuộn trang:

| Cột | Nội dung |
|---|---|
| Trái (`14rem`) | "Niêm phong" là `legend` của nhóm chọn, một câu mô tả, rồi danh sách dọc các loại: Không, Câu đố, Hẹn giờ, Trao đổi (sách riêng tư chỉ còn Không và Hẹn giờ). Mỗi dòng là radio, tên đậm và một dòng mô tả; dòng đang chọn nền `--blue-1` với vạch mỏng 3px `--blue-line` bên trái, như dấu trang trong mục lục. Chân cột: câu xác nhận "Đăng **N trang** vào **Tên sách**, khóa bằng câu đố.", lỗi chung (`role="alert"`) nếu có, rồi nút chính "Đăng" và nút viền "Để sau". |
| Giữa (`20rem`) | Tên loại (h2, ≤ 20 ký tự), câu nói ai đọc được khi nào, rồi các ô của loại đó: câu hỏi, đáp án, gợi ý, ngày giờ mở. Chọn Không thì cột này không có, tờ giấy lấy chỗ. |
| Phải (phần còn lại) | "Đọc lại và sửa ngay trên trang", các tờ đang viết thu phóng vừa ô (cả bề ngang lẫn chiều cao), và nút lật "Tờ 1-2 / 3" (44px) khi số tờ nhiều hơn số tờ đang hiện. |

Bề rộng:

- Trên 1180px: hai tờ cạnh nhau như màn đọc, ghép (1, 2), (3, 4) theo `src/lib/flip.ts`; số tờ lẻ thì trang phải của khung cuối để trống. Gáy là vạch 1px `--nep-vach` cùng bóng `--nep-bong` 22px mỗi bên.
- 901 đến 1180px: một tờ, cột trái `13rem`, cột giữa `17.5rem`. Bóng mép trái `--nep-bong-hep` 14px.
- Từ 900px trở xuống: xếp dọc. Các loại thành lưới 2 x 2, rồi câu xác nhận và hai nút, rồi các ô, rồi một tờ (chỉ thu theo bề ngang, không lớn hơn cỡ thật), trang được cuộn như thường.

Luật sửa và đăng:

- Vùng soạn thảo vẫn sửa được trong lúc chọn niêm phong. Số trang trong câu xác nhận tính lại sau mỗi lần xếp trang. Chỉ từ lúc bấm "Đăng" vùng soạn thảo mới khóa, nháp được lưu lần cuối, và bộ cắt trang chạy lại một lần nữa: thứ được đăng là đúng chữ có trên trang lúc đó.
- Tờ được xem cạnh nhau bằng cột CSS (multi-column) của chính vùng soạn thảo, mỗi cột cao đúng một bước tờ (540 + 28px), rộng đúng một tờ. Không đổi cỡ chữ, không đổi bề rộng, không đụng bộ xếp trang: cột chỉ cắt giữa khối đệm ngắt trang, nên mỗi tờ vẫn bắt đầu đúng chỗ màn đọc bắt đầu. Khung ngoài dùng `overflow: clip` (không thành vùng cuộn), lật bằng `transform`, thu phóng cả khung bằng `transform`.
- Con trỏ chạy sang tờ đang khuất (gõ tràn, phím mũi tên) thì khung tự lật tới tờ đó; bấm nút lật thì không bị kéo ngược.
- Focus: mở khung thì focus vào loại đang chọn; thứ tự Tab trái, giữa, phải; "Để sau" trả focus về nút "Đăng trang"; đáp án chỉ có dấu câu thì focus vào đúng dòng lỗi như trước.
- Chế độ Tập trung chỉ làm mờ đoạn khi con trỏ đang ở trong trang; lúc đọc lại để chọn niêm phong thì chữ rõ hết.

Chuyển động: mỗi lần đổi loại, cột giữa trượt vào 8px và hiện dần, 220ms, `--ease-out`, chỉ `transform` và `opacity`. Với `prefers-reduced-motion: reduce` cột giữa hiện thẳng. Lật tờ trong khung không có hoạt ảnh.

## 12. Sửa nội dung theo lượt đăng

Chủ sách sửa được chữ, ảnh, ghi âm của cả một lượt đăng (mọi tờ đăng cùng một lần). Số tờ của lượt đổi được; các tờ phía sau dời theo.

Luật của việc sửa:

- Chỉ chủ sách, chỉ lượt của sách mình. Người kia gọi thẳng action nhận đúng câu "Không tìm thấy lượt này." như với lượt lạ, không có gì được ghi.
- Lượt có niêm phong còn đóng với người kia (câu đố chưa giải, trao đổi chưa có trang trả lời, hẹn giờ chưa tới giờ) thì chưa sửa được; mở rồi thì sửa được. Dòng hé lộ cắt lúc đăng giữ nguyên.
- Vị trí tờ chỉ sống ở `pages.position`. Niêm phong và dòng Hoạt động bám lượt (`round_id`), khoảng tờ của chúng tính từ các tờ của lượt, nên sửa lượt không phải dời gì ngoài các tờ phía sau và mốc đã đọc.
- Màn sửa nối các tờ của lượt thành một tài liệu trên trình viết có ngắt trang của màn viết, lưu thì cắt lại bằng đúng bộ đo và bộ xếp trang của màn viết. Dấu `noiTiep` trên mọi khối bị cắt ngang giúp nối lại đúng chỗ, nên chưa sửa gì thì cắt lại ra đúng các tờ cũ.
- Không tự lưu lên máy chủ: chỉ "Lưu thay đổi" mới gửi. Hai tab sửa cùng một lượt được chặn bằng khóa lạc quan theo mốc phiên bản của lượt; tab giữ mốc cũ nhận "Lượt này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.".
- Lưu nháp, đăng, sửa lượt cùng khóa dòng sách trong giao dịch; mốc đã đọc cũng tính và ghi dưới khóa chia sẻ của dòng sách.
- Media giữ lại được là media đang có trên các tờ của lượt. Media bỏ khỏi lượt bị xóa hẳn ở lần dọn kế tiếp, màn sửa báo trước.

**Lối vào.** Màn sửa sách có mục "Nội dung": mỗi lượt một dòng "Lượt 2 · trang 6 tới 11 · 20.09" và nút viền "Sửa lượt này"; lượt còn niêm phong thay nút bằng chữ "Đang niêm phong" kèm ổ khóa 12px. Dải dưới cuốn sách của màn đọc giữ "Đã sửa lúc ..." (mốc sửa của lượt) cho cả hai người; với chủ sách mỗi tờ có "Sửa trang N" mở màn sửa lượt ngay tại tờ đó, hay dòng "Đang niêm phong, chưa sửa được". Đường dẫn cũ `/sach/[id]/sua-trang/[so]` chuyển 308 sang màn sửa lượt tương ứng.

**Màn sửa lượt** (`/sach/[id]/sua-luot/[luot]`, `?trang=N` mở tờ thứ N của lượt) dùng lại khung màn viết: tiêu đề "Sửa lượt 2", dòng phụ "Tên sách, đăng 18.09", số tờ, bộ đếm chữ khi gần trần 20 000, nút chính "Lưu thay đổi", nút viền "Hủy", "Thêm ảnh", "Ghi âm". Số in dưới tờ là số trang thật trong cuốn. "Hủy" hay "Về sách" khi đã đổi thì hiện hộp xác nhận nội tuyến, focus ở "Sửa tiếp", Esc trả focus về chỗ đã mở hộp. Chữ đang sửa được giữ tạm trong phiên trình duyệt; bản tạm quá 24 giờ của lượt khác bị dọn mỗi lần mở màn sửa. Lượt còn niêm phong không có trình soạn thảo: chỉ tiêu đề "Không sửa được", một câu giải thích và nút "Về trang N".

## 13. Lời hồi đáp theo lượt đăng

Người đọc gửi được đúng một lời hồi đáp cho mỗi lượt đăng của sách đang chia sẻ. Lời hồi đáp bất biến: không sửa, không xóa.

- **Chỗ đứng.** Cột phải của màn đọc: dưới thẻ "Nhạc nền" khi sách có nhạc (chỉ gắn sau "Mở sách"), đứng một mình khi sách không có nhạc. Dưới 980px cột phải xuống dưới cuốn sách. Sách riêng tư và sách chưa có tờ nào không có khung. Thẻ nhạc luôn là con đầu của cột phải, khung hồi đáp chèn sau nó, nên trình phát không bao giờ đổi chỗ trong DOM. Ở màn rộng chỉ thẻ nhạc dính, khung hồi đáp cuộn theo trang: nút "Gửi" luôn tới được dù lời dài tới đâu, còn trình phát thì không rời khỏi màn hình. Khi cuộn, khung trượt ra sau thẻ nhạc như một thẻ ghim quen thuộc và không bao giờ đè lên trình phát.
- **Theo tờ đang hiện.** Khung theo lượt của tờ đang hiện; hai trang thuộc hai lượt thì theo trang bên phải. Chữ đang gõ được giữ theo từng lượt khi lật qua lại; câu báo cho trình đọc màn hình và lời nhắc lỗi thì bỏ hẳn khi đổi lượt, lật về cũng không đọc lại.
- **Người đọc.** Ô chữ "Viết lời hồi đáp", bộ đếm "0/1000" đếm đúng như máy chủ (bỏ khoảng trắng hai đầu, gộp dòng trống còn tối đa hai, đếm theo ký tự), nút "Gửi". Gửi thì hỏi lại ngay trong khung "Gửi rồi sẽ không sửa được." với "Gửi" và "Xem lại" (focus sẵn ở "Xem lại", Esc cũng là "Xem lại"). Bấm đôi hay Enter hai lần chỉ gửi đúng một lời. Lượt còn niêm phong: "Mở niêm phong để hồi đáp.". Đã gửi: lời của mình kèm "Bạn gửi hôm nay, 07:41".
- **Người viết.** Lời hồi đáp kèm "Linh gửi hôm nay, 07:41", hoặc "Chưa có lời hồi đáp.".
- **Hình dáng.** Cùng dáng thẻ với "Nhạc nền"; lời đã gửi là một đoạn trích có vạch trái mảnh, giữ xuống dòng của người viết. Không mảng màu, không hoạt ảnh.
- **Dòng Hoạt động.** "Linh đã hồi đáp trang 6 tới 11 của <tên sách>", bấm vào mở màn đọc tại tờ đầu của lượt. Không kèm chip niêm phong.

## 14. Việc còn lại

`BookCard` (`src/components/book/BookCard.tsx`) cùng các lớp `.book*` trong `app.css` hiện chỉ còn dùng ở ô xem trước của form tạo và sửa sách. Khi màn form được vẽ lại, ô xem trước sẽ chuyển sang `ShelfBook` và `BookCard` được bỏ đi.
