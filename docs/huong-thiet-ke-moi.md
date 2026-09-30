# Hướng thiết kế mới

Tài liệu này ghi lại các quyết định giao diện đang áp dụng, bắt đầu từ màn Kệ sách. Các màn khác khi được vẽ lại sẽ theo đúng những quy tắc ở đây. Mọi giá trị màu, bóng, bán kính đều nằm trong `src/styles/tokens.css`; CSS của từng thành phần chỉ gọi token, không viết màu trực tiếp (có bài kiểm `tests/unit/css-tokens.test.ts`).

## 1. Token mới

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--radius-nut` | `8px` | Cả ba cấp nút |
| `--ke-mep` | `oklch(91.5% 0.012 75)` | Vạch mép kệ, vàng ấm rất nhạt, dày 1px. Chủ dự án chọn lại màu này ngày 26/09 thay cho nét vàng đậm qua cổng 3:1; nét trang trí nên không thuộc cổng tương phản |
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
| Chữ | `.btn--chu` | Chỉ là chữ đậm màu mực, đậm thêm một bậc khi rê chuột hay khi đi tới bằng phím. Không gạch chân ở bất cứ trạng thái nào | Hành động luôn có mặt nhưng không được tranh chỗ với nội dung, ví dụ "Trang mới" trên thanh điều hướng, hay "Đổi ở trang Viết tiếp" ở bước đăng. |

`.btn--sm` và `.btn--icon` vẫn ghép được với cả ba cấp.

## 3. Thanh điều hướng

- Nền thanh là `--nav-nen` (`oklch(95.5% 0.024 236)`), một màu xanh nước nhạt đặc, không trong suốt, sát mép trên của trang.
- Không có nền viên thuốc cho mục nào. Mục đang ở là chữ màu mực, đậm 600, kèm một gạch 2px màu mực đè lên vạch dưới của thanh. Các mục khác là chữ `--color-ink-2`.
- Người đang vào hiện bằng chữ: "Đang vào: **tên**". Không có ô tròn chữ cái. Từ 600px trở xuống dòng này ẩn đi.
- "Trang mới" là nút cấp chữ.
- Logo "sách thắt nơ" (`src/components/Logo.tsx`) đứng trước tên web, cao 30px, màu `--blue-ink`, dùng bộ lọc mực nhẹ `#muc-logo`. Biểu tượng tab (`src/app/icon.svg`) là cùng hình với nét dày hơn và không có bộ lọc để vẫn rõ ở 16px.
- Bốn mục: Kệ sách, Bản nháp, Dấu thời gian, Cài đặt.
- Từ 700px trở xuống, bốn liên kết xuống hàng riêng dưới tên web, mỗi liên kết cao 44px, dàn đều cả hàng với khe hẹp để vừa một hàng ở 320px. Người dùng phóng to chữ thì liên kết được xuống hàng thay vì tràn ngang.
- Giữ nguyên: `aria-current="page"` cho màn đang ở, `"true"` cho màn con; thanh dính đầu trang trừ khi `sticky={false}` (màn viết, màn đọc có nhạc: thanh không bao giờ đè lên trình phát YouTube).

## 4. Giấy và cuốn sách mở

Cuốn sách mở trên kệ ("X vừa viết") dùng cùng chất liệu với tờ giấy của màn đọc (`giay.css`), nhẹ tay hơn:

- Nền `--color-giay`, bóng `--bong-giay`, bo `--radius-sach-mo` ở mép ngoài.
- Tỉ lệ 4:3, tức hai tờ 360×540 của màn đọc đặt cạnh nhau. Nếp gáy là vạch 1px `--nep-vach` mờ dần hai đầu, cộng bóng `--nep-bong` rộng 22px mỗi bên.
- Trang trái: "**Tên** vừa viết" (hoặc "**Bạn** vừa viết"), tên sách Lexend 600 cỡ `--text-md` (tối đa 2 dòng), dòng "N trang, thời điểm", bìa thật của cuốn đó dán như tranh in, và một nút chính duy nhất sát chân trang: "Viết tiếp" nếu là sách của mình, "Đọc tiếp" nếu là sách người kia. "Đọc tiếp" qua tấm bìa như mọi lối vào từ kệ, rồi màn đọc mở ở tờ đầu chưa đọc; chỉ bấm vào chính khung mới mở thẳng tờ của đoạn trích.
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
- **Kệ chia tầng.** Mỗi hàng sách đứng trên một mép kệ, nên một hàng đọc ra là một tầng; khoảng cách dọc giữa hai tầng là `--space-xl`. Mỗi ngăn (của mình, của người kia) **thu gọn riêng còn ba tầng**. Số cột là sự thật của trình duyệt (đổi theo bề rộng và theo cỡ chữ), nên được đọc từ `grid-template-columns` đã tính chứ không chép lại bằng media query; sách bị gọn **không có trong cây** để phím Tab không đi vào chỗ không nhìn thấy. Trước khi trình duyệt chạy xong, máy chủ cắt sẵn ba tầng bằng CSS (`.ngan__gon`), nên không có JavaScript vẫn thấy đúng ba tầng.
- **Dải nút ẩn.** Đúng một dải cho mỗi ngăn, cao cố định 44px, ngay dưới tầng cuối đang hiện. Chữ "Mở rộng" / "Thu gọn" trong suốt cho tới khi rê chuột hoặc đi tới bằng phím Tab (`opacity`, 120ms), không bao giờ ẩn bằng `display: none` hay `visibility: hidden`. Tên đọc được: "Mở rộng kệ của bạn, còn 7 cuốn" / "Thu gọn kệ của bạn", kèm `aria-expanded`. Dải nút ở trạng thái thu gọn trông y như ở trạng thái mở rộng: chủ dự án bỏ gợi ý "hàng sách kế tiếp thò ra" ngày 26/09. Ba tầng trở xuống thì không có dải nút nào.
- Thành phần trình duyệt của ngăn chỉ nhận **đúng chín trường** một thẻ sách vẽ ra (`SachTrenKe`). Mọi prop của thành phần trình duyệt được chép vào gói dữ liệu gửi xuống, nên đưa cả dòng kệ vào là gửi kèm đoạn trích, kể cả của lượt còn niêm phong.

### Bìa tự đổi trên khung sách lớn

- Chỉ khung sách lớn ("X vừa viết") tự đổi bìa, và chỉ khi cuốn có **từ hai ô bìa trở lên**. Thẻ sách trên kệ luôn giữ bìa mới nhất.
- Nhịp **mười giây**, hiệu ứng **rọi sáng** dài 1,02 giây: một vệt sáng mỏng `--roi-sang-mau` trượt ngang, bìa cũ mờ đi ngay sau vệt, bìa mới nằm sẵn ở dưới và không bị động vào. Chỉ `transform` và `opacity`; lớp tạm nằm trong chính khung bìa nên khung không xê dịch một điểm ảnh nào. Dọn trong một lượt: trả mặt bìa mới, gỡ lớp tạm, hủy mọi hoạt ảnh.
- Bìa rút theo túi xáo: đi hết danh sách rồi mới lặp, và không bao giờ hiện lại bìa vừa hiện, kể cả lần đổi đầu tiên.
- Dừng được, theo WCAG SC 2.2.2: không đổi khi trang bị ẩn, khi con trỏ đang trên khung, khi khung giữ focus, khi đã chọn tạm dừng, và không bao giờ đổi khi máy bật giảm chuyển động. Nút "Tạm dừng hiệu ứng" là **một** công tắc dùng chung với bầu trời; khi không ai giữ tâm trạng (không có dải trời) thì khung sách tự đặt một nút cấp chữ cùng công tắc đó ngay dưới nó.

### Khung sách lớn luân phiên (đợt năm, 5a)

- Khung sách lớn hiện các **lượt chưa đọc** của cả hai phía, mới nhất trước, tối đa sáu: lượt của người kia mà mình còn trang chưa đọc (nhãn **"Bạn chưa đọc"**, chấm đặc, chữ đậm `--blue-ink` như "Trang mới"), và lượt của mình trong cuốn chia sẻ mà người kia còn trang chưa đọc (nhãn **"{tên} chưa đọc"**, chấm rỗng `.cham--rong`, chữ `--color-ink-2`: chỉ là thông tin, không phải việc của mình). Nhãn nằm ngay dưới dòng "N trang, thời điểm".
- Không có lượt nào chưa đọc: khung như cũ (cuốn có trang gần nhất). Một lượt: hiện lượt đó, không luân phiên, không dòng đếm. Từ hai lượt: thêm dòng đếm "Lượt chưa đọc 1 / 4" (`--text-xs`, `--color-ink-3`, số thẳng hàng) và cứ **15 giây** (`--dur-luan-phien`) đổi sang lượt kế, đổi cả cuốn (tên, bìa, nút).
- Lần đổi: chữ trang trái, tranh dán và trang phải mờ đi `--dur-doi-luot` (240ms, chỉ `opacity`), rồi lượt mới hiện và trang phải **gõ từng chữ** đúng nhịp mở khóa (`--dur-go`, con trỏ `.con-tro` nháy thêm một chu kỳ rồi tắt). Lượt còn niêm phong với người xem chỉ gõ dòng hé lộ. Lần vẽ đầu hiện đủ chữ ngay. Trình đọc màn hình đọc bản đầy đủ một lần (chữ ẩn), phần đang gõ ẩn với nó; vùng không `aria-live`.
- Đoạn của mỗi lượt: đoạn đã chọn (dấu `doanKe`), không thì một đoạn ngẫu nhiên cố định theo ngày trong các trang có chữ của lượt, hay dòng hé lộ khi lượt còn niêm phong. Nút chính: lượt của người kia "Đọc tiếp" (qua tấm bìa, tới trang đang đọc dở), lượt của mình "Viết tiếp". Cả khung mở đúng trang của đoạn đang hiện.
- **Bố cục trang trái khi có nhãn** (`.sach-mo--luot`, màn rộng): khối chữ cao hơn (nhãn, dòng đếm, có khi nút tạm dừng) nên tranh dán không đặt giữa trang nữa mà nằm ở dòng giữa của lưới, giữa khối chữ và nút chính, và **co lại vừa chỗ trống**. Khung giữ đúng 4:3 (`min-height: 0`: kích thước tự nhiên của tranh không kéo khung cao thêm), nên lượt tên một dòng và lượt tên hai dòng cao như nhau, đổi lượt không xô dịch kệ. Đo trên bản build ở 641 tới 1280px, hai chế độ chuyển động: không chồng, không tràn, lề ngang 31 tới 36px. Khung không có lượt chưa đọc giữ bố cục cũ.
- Dừng khi con trỏ hay focus ở trong khung, khi tab ẩn, và theo công tắc "Tạm dừng hiệu ứng" chung. Giảm chuyển động: **vẫn đổi lượt** nhưng đổi ngay, không mờ, không gõ; vì lượt vẫn đổi nên lúc đó vẫn phải có một nút tạm dừng: trang không có dải trời thì nút của khung hiện cả khi giảm chuyển động (`.bia-dung--luon`), trang có dải trời thì nút của khung chỉ hiện khi giảm chuyển động (`.bia-dung--giam`, lúc nút của dải trời bị giấu). Mỗi lúc chỉ một nút.

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
- **Dấu Mới (đợt năm, phương án A).** Việc người kia làm mà mình chưa xem có ở cột phải, ngay dưới giờ, một chấm 6px và chữ đậm "Mới" (`.dh--moi`, cỡ `--text-xs`); trình đọc màn hình nghe ", mới" ngay sau câu. Việc của chính mình không bao giờ có dấu. Tính là đã xem khi con trỏ hay focus vào dòng, hoặc dòng nằm trong khung nhìn (ít nhất một nửa, vùng cuộn cắt sẵn phần khuất) liên tục `--dur-moi-xem` (1 giây). Lúc đó dấu **tan chậm** `--dur-moi-tan` (3 giây, chủ dự án chọn: tan nhanh quá thì không kịp thấy), chỉ `opacity`, chỗ của dấu vẫn giữ nên dòng không xê dịch; giảm chuyển động thì ẩn ngay. Trình duyệt gom các dòng vừa xem, gửi một lần sau 800ms; máy chủ chỉ ghi dòng người đó được thấy. Dòng gộp (đổi liền nhiều lần) cập nhật giờ thì lại là Mới.
- **Loại mới (đợt năm):** thả tâm trạng (dòng phụ là lời nhắn, bấm tới Lịch hoa), tạo sách, đổi tên sách ("đổi tên **A** thành **B**", câu có hai phần đậm), đổi bìa và đổi nhạc (theo lượt hay lúc tạo sách; nhãn là tên tranh, "Ảnh của X", tên bài và kênh lấy ở máy chủ, "Tắt nhạc", "Giữ bìa trước", "Phát tiếp bài trước"), sửa trang, và "X đã đọc tới trang N" (chỉ chủ sách thấy). Đổi liền nhiều lần trong 10 phút (đọc: 30 phút) gộp thành một dòng; đổi rồi đổi lại như cũ thì dòng biến mất. Trang đăng kèm bìa hay nhạc riêng của lượt có nhãn "Bìa mới", "Nhạc mới".

## 9. Chuyển động và vi tương tác

Chỉ có hai vi tương tác trên kệ, cả hai do người dùng kích hoạt và chỉ dùng `transform`:

- **Rút sách**: rê chuột hoặc focus vào một cuốn thì bìa nhích lên 6px và xoay nhẹ quanh gáy (`rotateY(-6deg)`), 220ms, `--ease-out`, kèm bóng `--bong-rut-sach`.
- **Tranh dán đặt thẳng**: rê chuột hoặc focus vào cuốn sách mở thì tranh dán xoay từ `--tranh-nghieng` về 0.

Với `prefers-reduced-motion: reduce`: sách không rút ra (chỉ còn bóng đổi màu 150ms), tranh dán giữ nguyên góc nghiêng. Không hiện dần từng khối khi cuộn.

Trang Kệ sách có đúng ba thứ **tự chạy**, cả ba được chủ dự án chọn có chủ ý và cả ba nghe **một** công tắc "Tạm dừng hiệu ứng": nét vẽ của bầu trời trong dải trời, bìa tự đổi của khung sách lớn, và khung sách lớn luân phiên các lượt chưa đọc (đợt năm, mục 5). Hai thứ đầu đứng yên hẳn khi máy bật giảm chuyển động; khung luân phiên vẫn đổi lượt nhưng không mờ, không gõ. Dấu Mới tan chậm của cột Hoạt động là phản hồi cho việc người dùng vừa xem, không phải hiệu ứng tự chạy. Không thêm hiệu ứng tự chạy nào khác.

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
- **Chỉ viết thêm và sửa chính tả** (chủ dự án 28/09). Luật là hàm thuần `src/lib/doc/chi-them.ts`, dùng chung máy chủ và trình duyệt. Chữ là mọi đoạn `[\p{L}\p{N}]+` trong tài liệu đã nối, từng khối văn bản riêng. Hai chữ giống nhau khi y hệt, bằng nhau sau khi bỏ dấu tiếng Việt và viết thường, hoặc cách nhau tối đa 1 ký tự (chữ dài tới 4 ký tự) hay 2 ký tự (chữ dài hơn). Bản sửa hợp lệ khi mọi chữ cũ khớp được, đúng thứ tự, vào một chữ mới giống nó, và mọi ảnh, ghi âm cũ còn đủ. Dấu câu, khoảng trắng, định dạng, tách hay gộp đoạn thì tự do. Máy chủ kiểm lại trước lệnh ghi đầu tiên; vi phạm thì không ghi gì và báo "Có chữ, ảnh hay ghi âm cũ bị xoá. Chỉ được viết thêm và sửa chính tả.".
- Sửa được **cả lượt còn niêm phong** (chủ dự án 28/09), kể cả hẹn giờ chưa tới giờ: chủ sách thấy chữ của chính mình trong trình sửa. Người kia vẫn không bao giờ tới được trang sửa (404), và HTML của màn đọc bên người kia không có chữ nào của lượt, kể cả chữ vừa viết thêm. Niêm phong giữ nguyên sau khi sửa: dòng hé lộ cắt lúc đăng, ngưỡng và nơi kiểm đáp án không đổi.
- Vị trí tờ chỉ sống ở `pages.position`. Niêm phong và dòng Hoạt động bám lượt (`round_id`), khoảng tờ của chúng tính từ các tờ của lượt, nên sửa lượt không phải dời gì ngoài các tờ phía sau và các dòng tờ đã xem (`read_sheets`) bám theo vị trí tờ. Lượt ngắn lại thì dòng tờ đã xem của những tờ không còn nữa bị xóa, để chúng không bám nhầm sang tờ của lượt sau khi các tờ đó lùi về.
- Màn sửa nối các tờ của lượt thành một tài liệu trên trình viết có ngắt trang của màn viết, lưu thì cắt lại bằng đúng bộ đo và bộ xếp trang của màn viết. Dấu `noiTiep` trên mọi khối bị cắt ngang giúp nối lại đúng chỗ, nên chưa sửa gì thì cắt lại ra đúng các tờ cũ.
- Không tự lưu lên máy chủ: chỉ "Lưu thay đổi" mới gửi. Hai tab sửa cùng một lượt được chặn bằng khóa lạc quan theo mốc phiên bản của lượt; tab giữ mốc cũ nhận "Lượt này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.".
- Lưu nháp, đăng, sửa lượt cùng khóa dòng sách trong giao dịch; các tờ đã xem (`read_sheets`) cũng đọc và ghi dưới khóa chia sẻ của dòng sách.
- Ảnh và ghi âm cũ không bỏ được: trình sửa chặn mọi thao tác làm mất chúng và không hiện nút "Bỏ ảnh", "Bỏ ghi âm" trên chúng. Ảnh, ghi âm vừa thêm trong lần sửa thì vẫn bỏ được.

**Lối vào.** Dải dưới cuốn sách của màn đọc giữ "Đã sửa lúc ..." (mốc sửa của lượt) cho cả hai người; với chủ sách **mọi** tờ, kể cả tờ niêm phong, có "Sửa trang N" mở màn sửa lượt ngay tại tờ đó. Màn Sửa sách không còn mục "Nội dung" (28/09): chủ sách sửa thẳng từ màn đọc. Đường dẫn cũ `/sach/[id]/sua-trang/[so]` chuyển 308 sang màn sửa lượt tương ứng.

**Màn sửa lượt** (`/sach/[id]/sua-luot/[luot]`, `?trang=N` mở tờ thứ N của lượt) dùng lại khung màn viết: tiêu đề "Sửa lượt 2", dòng phụ "Tên sách, đăng 18.09", số tờ, bộ đếm chữ khi gần trần 20 000, nút chính "Lưu thay đổi", nút viền "Hủy", "Thêm ảnh", "Ghi âm". Số in dưới tờ là số trang thật trong cuốn. "Hủy" hay "Về sách" khi đã đổi thì hiện hộp xác nhận nội tuyến, focus ở "Sửa tiếp", Esc trả focus về chỗ đã mở hộp. Chữ đang sửa được giữ tạm trong phiên trình duyệt; bản tạm quá 24 giờ của lượt khác bị dọn mỗi lần mở màn sửa.

- **Vùng ghi chú** dưới thanh công cụ luôn có dòng "Chỉ viết thêm và sửa chính tả. Chữ, ảnh và ghi âm đã đăng không xoá được."; lượt còn niêm phong thêm "Lượt này đang niêm phong với Linh. Sửa xong vẫn giữ niêm phong như cũ."; có thêm hay sửa thì "Viết thêm 6 chữ, sửa 1 lỗi chính tả. Chữ nền xanh nhạt là chữ bạn vừa thêm hay vừa sửa.".
- **Chữ vừa thêm hay vừa sửa** có nền `--blue-1`, không gạch chân. **Chữ cũ bị xoá** hiện lại đúng chỗ: chữ mờ gạch ngang, là một nút (bấm, Enter hay Space thì chèn trả lại đúng chỗ, tự thêm khoảng trắng khi cần). Còn chữ cũ bị xoá thì "Lưu thay đổi" khoá, vùng ghi chú báo "**Còn 1 chữ cũ bị xoá.** Bấm vào chữ gạch ngang để trả lại, rồi mới lưu được." kèm nút chữ "Trả lại hết".
- So sánh chạy sau khoảng 300ms không gõ và không chạy khi đang gõ bằng bộ gõ (IME, Unikey, Telex). Giao diện cần biết chữ nào thêm, sửa, mất và mất ở đâu: cắt phần đầu và đuôi y hệt, khớp mốc bằng thuật toán Myers, rồi quy hoạch động trên từng khe giữa hai mốc (khe quá lớn thì ghép tham lam). Một lượt 20 000 chữ sửa ở cả hai đầu vẫn tính dưới 80ms.

## 13. Lời hồi đáp theo lượt đăng

Người đọc gửi được đúng một lời hồi đáp cho mỗi lượt đăng của sách đang chia sẻ. Lời hồi đáp bất biến: không sửa, không xóa.

- **Chỗ đứng.** Cột phải của màn đọc: dưới thẻ "Nhạc nền" khi sách có nhạc (chỉ gắn sau "Mở sách"), đứng một mình khi sách không có nhạc. Dưới 980px cột phải xuống dưới cuốn sách. Sách riêng tư và sách chưa có tờ nào không có khung. Thẻ nhạc luôn là con đầu của cột phải, khung hồi đáp chèn sau nó, nên trình phát không bao giờ đổi chỗ trong DOM. Ở màn rộng **cả cột phải dính thành một khối** (chủ dự án 26/09): khung hồi đáp luôn nằm ngay dưới thẻ nhạc và cuộn theo nó, không bao giờ trượt vào dưới thẻ nhạc mà bị che. Khối cao tối đa bằng khung nhìn trừ hai mép; khung hồi đáp là phần co lại được và cuộn bên trong khi dài hơn chỗ còn lại, nên nút "Gửi" luôn tới được. Sách không nhạc thì khung hồi đáp dính ngay dưới thanh điều hướng (cao `--nav-cao`). Dưới 980px không dính gì.
- **Theo tờ đang hiện.** Khung theo lượt của tờ đang hiện; hai trang thuộc hai lượt thì theo trang bên phải. Chữ đang gõ được giữ theo từng lượt khi lật qua lại; câu báo cho trình đọc màn hình và lời nhắc lỗi thì bỏ hẳn khi đổi lượt, lật về cũng không đọc lại.
- **Người đọc.** Ô chữ "Viết lời hồi đáp", bộ đếm "0/1000" đếm đúng như máy chủ (bỏ khoảng trắng hai đầu, gộp dòng trống còn tối đa hai, đếm theo ký tự), nút "Gửi". Gửi thì hỏi lại ngay trong khung "Gửi rồi sẽ không sửa được." với "Gửi" và "Xem lại" (focus sẵn ở "Xem lại", Esc cũng là "Xem lại"). Bấm đôi hay Enter hai lần chỉ gửi đúng một lời. Lượt còn niêm phong: "Mở niêm phong để hồi đáp.". Đã gửi: lời của mình kèm "Bạn gửi hôm nay, 07:41".
- **Người viết.** Lời hồi đáp kèm "Linh gửi hôm nay, 07:41", hoặc "Chưa có lời hồi đáp.".
- **Hình dáng.** Cùng dáng thẻ với "Nhạc nền"; lời đã gửi là một đoạn trích có vạch trái mảnh, giữ xuống dòng của người viết. Không mảng màu, không hoạt ảnh.
- **Dòng Hoạt động.** "Linh đã hồi đáp trang 6 tới 11 của <tên sách>", bấm vào mở màn đọc tại tờ đầu của lượt. Không kèm chip niêm phong.

## 14. Đoạn hiện trên kệ

Khung sách trên Kệ sách luôn lấy đoạn từ lượt đăng mới nhất của cuốn.

- **Người viết chọn.** Bôi đen một câu trong màn viết (hoặc màn sửa lượt) rồi bấm "Chọn làm đoạn trên kệ" trên thanh công cụ. Đoạn đã chọn được tô một vệt xanh nhạt ngay trong trang đang viết. Chọn lại là thay chỗ cũ, bấm lần nữa là bỏ; dấu cũ chỉ được gỡ trong tài liệu đang mở, tức trong chính lượt đang viết hay đang sửa, nên mỗi lượt đăng giữ một đoạn của riêng nó và các lượt cũ vẫn giữ dấu của chúng. Kệ sách chỉ đọc lượt mới nhất, nên bấm nút trong lúc sửa một lượt CŨ không đổi gì trên kệ. Dấu chọn nằm trong tài liệu của tờ nên đi theo tờ khi đăng và khi sửa lượt. Màn đọc không vẽ dấu này.
- **Không chọn gì.** Khung lấy ngẫu nhiên một đoạn có chữ trong chính lượt mới nhất, tất định theo cuốn, người xem và ngày Việt Nam: cùng ngày tải lại vẫn là đoạn đó, sang ngày thì đổi.
- **Lượt mới nhất còn niêm phong.** Không hiện chữ nào, chỉ dòng hé lộ như trước.
- **Trang mới.** Bấm khung mở thẳng tới tờ chứa đoạn, và chỉ những tờ thật sự lật qua mới tính là đã đọc; các tờ bị nhảy cóc vẫn là trang mới trên kệ.

## 15. Bìa và nhạc theo từng lượt đăng

Một cuốn không còn đúng một bìa và một bản nhạc. Mỗi cuốn giữ **hai dòng thời gian**: một danh sách ô bìa và một danh sách ô nhạc, mỗi lượt đăng nhiều nhất một ô, cộng đúng một ô mở đầu lúc tạo sách. Bìa và nhạc cuốn đang dùng là ô mới nhất của mỗi dòng.

Mục gập "Đổi bìa, tên, nhạc" ở bước đăng **đã bị bỏ hẳn**. Ba chỗ trùng việc trước đây (Sửa sách / Viết tiếp / mục gập) nay chia rành mạch:

**Trang Viết tiếp** (`/sach/[id]/viet-tiep`). Mọi nút "Viết tiếp" và "Viết trang đầu" dẫn về đây trước khi vào màn viết.

- Cùng khung `.tao` với trang Sách mới, nhưng **không có ô tên sách và không có mục "Ai đọc được"**: hai thứ đó là thuộc tính của cả cuốn, đổi chúng vẫn ở Sửa sách.
- Chỉ hai thứ: bảng chọn bìa và ô nhạc nền. Cả hai để trống được; trống nghĩa là lượt này không thêm ô nào và cuốn giữ nguyên bìa với nhạc đang có.
- Ô đầu tiên của bảng bìa là **"Giữ bìa đang dùng"**, một ô nét đứt cùng dáng với ô chọn tệp. Trang Sách mới không có ô này (cuốn mới bắt buộc phải có bìa); dòng thời gian Bìa của Sửa sách có ô cùng dáng tên "Giữ bìa trước" ở mọi mốc trừ mốc tạo sách.
- Cuốn đang có nhạc thì dưới ô nhạc có ô đánh dấu "Gỡ nhạc nền cho lượt này". Bật thì ô nhập nhạc khóa lại và xóa trắng; ô nhạc của lượt này thành **ô gỡ nhạc**, tức từ lượt đó cuốn im.
- Hai nút: "Viết trang" (nút chính, được đưa focus ngay khi trang mở, nên bấm Enter là đi thẳng vào màn viết) và "Thôi" (về màn đọc của chính cuốn đó).
- Ô xem trước bên phải vẽ thẻ sách với bìa đang chọn kèm câu "Bìa này bắt đầu từ lượt bạn sắp đăng.", hoặc bìa hiện hành kèm "Cuốn giữ bìa đang dùng.".
- Lựa chọn được giữ trong chính bản nháp của cuốn, chưa thành ô thật. Quay lại trang này giữa chừng thì các ô điền sẵn theo nháp đang có, không phải theo bìa hiện hành. Lúc bấm Đăng nó mới thành ô thật gắn với lượt vừa sinh; bỏ bản nháp là bỏ luôn lựa chọn.

**Bước đăng** có **một dòng chữ tĩnh** thay chỗ mục gập: "Lượt này thêm bìa Cành hoa đào và nhạc nền." (hoặc "Lượt này không thêm bìa hay nhạc.") kèm liên kết cấp chữ "Đổi ở trang Viết tiếp". Chỉ đọc, không ô nhập nào, nên bước đăng ngắn đi chứ không dài ra.

**Màn Sửa sách** (bản chủ dự án duyệt 28/09) xếp **cùng thứ tự với trang Sách mới**: Tên sách, **Bìa**, **Nhạc nền**, Ai đọc được, rồi "Lưu" và "Hủy", ô Xem trước bên phải. Dòng phụ "Đổi tên, ai đọc được, bìa và nhạc từng lượt.". Không còn mục "Nội dung" (sửa chữ ngay từ màn đọc, mục 12). "Lưu" chỉ lưu tên và người đọc; ô Xem trước lấy bìa hiện hành từ máy chủ nên đổi theo ngay khi một ô bìa vừa lưu.

Bìa và Nhạc nền là hai **dòng thời gian thu gọn** (`DongThoiGian.tsx`, dùng chung cho cả hai):

- **Khung.** Một ô viền như ô nhập (`--color-rule-ui`, `--radius-sm`), nhãn trường ở trên như mọi trường của trang Sách mới. Dòng tóm tắt là một nút (`aria-expanded`) chiếm cả bề ngang: bên trái là thứ đang dùng, bên phải chữ "Theo lượt" hay "Thu gọn" kèm mũi tên xoay; từ 480px trở xuống chỉ còn mũi tên (chữ vẫn đọc được bằng trình đọc màn hình). **Mặc định thu gọn**, nên hai trường chỉ cao đúng một dòng.
- **Mở và thu** bằng chiều cao chạy từ 0 tới vừa nội dung (lưới `grid-template-rows: 0fr` tới `1fr`), nhịp của hộp Thả tâm trạng: mở `--dur-tha-mo` (320ms, ease-out), thu `--dur-tha-dong` (260ms). Phần đang đóng mang `inert`, nên Tab không lọt vào. Giảm chuyển động thì mở và thu tức thì (luật chung trong `globals.css`).
- **Mốc.** Mỗi ô của dòng thời gian, **kể cả lượt chưa đặt gì**, là một nút cao tối thiểu 56px: ngày (đậm) và tên lượt ("Tạo sách", "Lượt 3") ở cột trái, một nút tròn trên sợi dọc xanh nhạt, nội dung, mũi tên. Sợi dọc hở một khoảng quanh mỗi nút tròn, không có vòng bóng nào che sợi.
- **Rũ xuống.** Bấm một mốc thì bảng chọn **rũ xuống ngay dưới mốc đó** (cùng kiểu chuyển động, nội dung trượt xuống 6px và hiện dần), mốc đang mở có nền `--blue-1`. Một lúc chỉ rũ một mốc; bấm mốc khác thì mốc cũ cuộn lên. Esc cuộn lên và trả focus về mốc. **Chọn là lưu** bằng đúng các server action sẵn có (`actionSetCoverEntry`, `actionRemoveCoverEntry`, `actionSetTrackEntry`, `actionRemoveTrackEntry`), lưu xong bảng tự **cuộn lên** và focus về mốc. Dưới khung: "Đã lưu bìa lượt 3." kèm nút chữ "Hoàn tác" (ghi lại giá trị cũ, rồi "Đã trả lại như cũ."). Máy chủ từ chối thì bảng giữ mở và báo lỗi ngay trong đó. Chưa lưu gì thì dòng gợi ý "Bấm một mốc để đổi bìa của lượt đó. Chọn xong là lưu.".
- **Bìa.** Tóm tắt: xấp nhỏ tối đa ba bìa gần nhất xòe nghiêng, tên bìa đang dùng, "4 bìa qua 6 lượt đăng". Mốc: nút tròn đặc khi lượt có bìa riêng, rỗng khi giữ bìa trước; bìa nhỏ tỉ lệ 5:3 (mờ đi khi giữ bìa trước, sọc nhạt khi chưa có bìa nào); tên bìa hay "Giữ bìa trước"; dấu "Đang dùng" ở bìa đang lên kệ. Bảng rũ xuống là bảng của `CoverPicker` **hiện đủ, không vùng cuộn** (`cuon-vung--tron`), ô tối thiểu 96px (dưới 480px còn 84px, để 375 và 414px vẫn hai cột; 320px một cột vì hai cột thì ô thấp hơn 44px), có ô "Giữ bìa trước" (bỏ ô của lượt đó) ở mọi mốc trừ mốc tạo sách, và ô "Thêm ảnh" với bước cắt ảnh như cũ. Mốc tạo sách không có "Giữ bìa trước", nên cuốn luôn còn ít nhất một bìa; máy chủ vẫn từ chối bỏ ô bìa cuối cùng.
- **Nhạc nền.** Tóm tắt: nốt nhạc trong vòng tròn nhạt, bài phát khi mở sách (hay "Không có nhạc") kèm kênh, "3 lần đặt nhạc qua 6 lượt đăng". Mốc: nốt (lượt đặt bài, tên bài và kênh), nút tròn rỗng ("Phát tiếp"), nốt gạch chéo ("Tắt nhạc từ lượt này"); sợi dọc liền ở đoạn có nhạc, chấm ở đoạn im; dấu "Đang phát" ở bài đang phát khi mở sách. Tên bài lấy ở máy chủ bằng `tenCacBai`, lấy không được thì "Bản nhạc trên YouTube". Bảng rũ xuống: ba nút viên thuốc "Một bài", "Phát tiếp {bài trước}", "Tắt nhạc" (mốc tạo sách: "Một bài", "Không nhạc") và ô dán link YouTube; "Phát tiếp" và "Không nhạc" là bỏ ô, "Tắt nhạc" là ô gỡ nhạc, link đọc ra video là lưu. Enter trong ô link không gửi form Sửa sách.
- Mỗi ô là một lần gửi riêng, một giao dịch riêng. Một ô hỏng không kéo theo ô khác.

**Bảng chọn bìa thành kho ảnh.** Bảng có mười tranh vẽ, rồi **mọi ảnh bìa của cuốn** (mới nhất trước), rồi một ô chọn tệp ở cuối.

- Tải ảnh lên là **không giới hạn** và chỉ **thêm** một ô vào bảng; không ảnh nào bị thế chỗ, kể cả ảnh không ô nào đang chọn. Ảnh bìa đã thuộc một cuốn thì bước dọn rác không bao giờ chạm tới.
- Mỗi ô ảnh có nhãn riêng ("Ảnh của bạn, tải 20.09") để trình đọc màn hình phân biệt được.
- Ô ảnh vẫn mang giá trị là một tranh vẽ dự phòng, nên trường `cover` của biểu mẫu luôn là một tranh; id ảnh đi trong trường ẩn `coverMedia`.
- Ở trang Sách mới và Viết tiếp, cả bảng nằm trong một vùng cuộn cao tối đa 300px (ở Sửa sách bảng hiện đủ trong phần rũ xuống), **không thấy thanh cuộn**: `scrollbar-width: none` cộng `::-webkit-scrollbar { display: none }`. Dấu hiệu "còn nữa" là một dải mờ dính ở mép dưới, kéo ngược lên đúng chiều cao của nó, còn lưới ô có đúng chừng ấy đệm dưới, nên cuộn tới đáy thì dải mờ nằm trọn trên khoảng trống và không còn nhìn thấy. **Cùng một cơ chế với cột Hoạt động (mục 8), làm bằng CSS thuần**: không nghe sự kiện cuộn, không đọc bố cục lúc cuộn, không có gì phải dọn.
- Vùng cuộn có đệm 6px ba phía để vòng focus của ô không bị cắt mất, vì `overflow-y: auto` cắt cả hai chiều.
- Khi bảng mở, ô đang chọn được kéo vào tầm nhìn bằng cách gán `scrollTop` của chính vùng cuộn, không dùng `scrollIntoView` (hàm đó cuộn cả trang và làm màn nhảy).
- Đợt này **không** có đường xóa ảnh khỏi kho: xóa một ảnh đang nằm trong một ô của dòng thời gian sẽ làm thủng một ô lịch sử.

## 16. Trang Dấu thời gian

Dòng thời gian **nhạc** của **một** cuốn, đặt lên một lịch tháng cùng khung với Lịch hoa (chủ dự án chốt lại ngày 26/09: "đổi lại giao diện lịch đẹp như lịch hoa"). Từ 28/09 trang **chỉ còn nhạc** (chủ dự án: "không cần lưu dấu thời gian của bìa đâu, chỉ cần lưu lại nhạc là được"): bìa theo lượt vẫn còn trong dữ liệu và vẫn đặt được ở Viết tiếp và Sửa sách, chỉ trang này không đọc tới nữa. Trình xem bìa, xấp bìa lớn và mọi token chỉ chúng dùng đã bỏ hẳn.

**Ba lối vào**, không lối nào đặt ở đầu màn đọc (chủ dự án bác chỗ đó):

- Mục **"Dấu thời gian"** trên thanh điều hướng dẫn tới **trang chọn cuốn** (`/dau-thoi-gian`): đúng những cuốn người xem thấy được trên kệ, mỗi dòng một bìa nhỏ, tên sách và dòng phụ "Bạn, 2 bản nhạc". Dòng đầu trang: "Chọn một cuốn để nghe lại nhạc của nó theo thời gian."; chưa có cuốn nào thì "Mỗi lượt đăng đặt được một bản nhạc. Tạo cuốn đầu tiên để bắt đầu.". Ô gỡ nhạc không tính là một bản nhạc. Dòng dùng lại hình dáng dòng của trang Bản nháp; cả dòng là vùng bấm (lớp `::after` của liên kết tên sách phủ kín dòng), vòng focus nằm trên chính liên kết, và tên sách xuống dòng trọn vẹn thay vì cắt bằng dấu ba chấm như trang Bản nháp, vì tên là cách duy nhất phân biệt hai cuốn.
- Bấm **ảnh bìa** trên khung sách lớn ở Kệ sách. Ảnh bìa là một liên kết riêng ("Dấu thời gian của <tên sách>"), nằm ngoài lớp phủ của khung sách trong cây và nằm trên nó theo thứ tự lớp, nên không có liên kết lồng nhau và bấm chỗ khác trên khung vẫn tới màn đọc.
- Bấm **tiêu đề "Nhạc nền"** của thẻ nhạc ở màn đọc. Chỉ dòng tiêu đề là liên kết, không phải cả thẻ: khung YouTube nằm ngay dưới và không lớp nào được đè lên nó. Liên kết cao 44px, đậm thêm một bậc khi rê chuột hay đi tới bằng phím, không gạch chân.

**Trang của một cuốn** (`/dau-thoi-gian/[id]`), bản hai (chủ dự án chốt bản xem trước ngày 26/09). Lịch gọn bên trái dùng lại khung Lịch hoa (`.thang`, `.lich`, `.tuan`, `.ngay` trong `tam-trang.css`), mọi luật riêng nằm trong `dau-thoi-gian.css` (nạp sau `tam-trang.css`); cột phải rộng 30rem, dính khi cuộn ở màn rộng, xuống dưới lịch từ 1000px trở xuống.

- Đầu trang: tên sách, rồi "Sách của <ai>. Nhạc của cuốn này theo từng ngày."
- Dòng đầu lịch: hai nút mũi tên đổi tháng **ngay tại chỗ**, không tải lại trang, đường dẫn vẫn ghi `?thang=YYYY-MM` để tải lại hay gửi link mở đúng tháng. "Tháng 9, 2026" ở giữa là vùng `aria-live`; dòng tổng "4 lần đổi nhạc trong tháng" bên phải. Tháng sớm nhất là tháng cuốn được tạo, muộn nhất là tháng này; nút ở hai đầu tắt. `?thang` sai hay ngoài khoảng thì về tháng mặc định.
- Lịch gọn hơn Lịch hoa: cột tên làn 48px với một làn **Nhạc** cao 30px. Làn nhạc là **nốt nhạc** 13px (dưới 420px còn 11px, không khe, để ba nốt vừa ô ngày 36px), mỗi lần đổi nhạc một nốt, tối đa ba; lần gỡ nhạc là nốt gạch chéo màu mực nhạt. Không còn con số đếm. Ngày không đổi nhạc là vòng chấm mờ 8px. Ô ngày ở 320px vẫn rộng từ 36px (bỏ cột tên làn như Lịch hoa). Tên ô cho trình đọc màn hình: "26 tháng 9. 4 lần đổi nhạc. Hôm nay" hay "... Không đổi nhạc".
- **Cột phải là một thẻ**: đầu thẻ là ngày đang chọn (vùng `aria-live`): tên ngày và "2 lượt đăng, 2 lần đổi nhạc." hay "Ngày này không đổi nhạc."; ngay dưới là phần "Nhạc trong ngày". Ngày không có nhạc thì phần nhạc chỉ còn câu "Chọn một ngày có nốt nhạc trên lịch.".
- **Nhạc trong ngày**: khung phát YouTube 16:9, tối thiểu 200px, có nút điều khiển của YouTube; dòng đang phát (vùng `aria-live`) với tên bài và trạng thái; nút Phát/Tạm dừng và Bài kế tiếp (một cụm, xuống hàng cùng nhau); danh sách bài theo thứ tự lượt với tên bài, kênh, "Lượt 5, lúc 16:40"; bài đang phát in đậm, có ba vạch sóng nhạc chỉ chạy khi đang phát. Tên bài lấy từ oEmbed của YouTube **ở phía máy chủ** (`src/server/media/ten-youtube.ts`: chỉ mã hợp lệ, song song, hạn 1,5 giây, nhớ 7 ngày, lỗi nhớ 10 phút), lấy không được thì "Bản nhạc trên YouTube". Gỡ nhạc là dòng không bấm được "Gỡ nhạc nền".
- **Khi nào nhạc tự phát**: chỉ khi bấm một ngày có nhạc, phát tuần tự, hết bài sang bài kế, bài hỏng thì bỏ qua. Bấm lại đúng ngày đang phát thì phát tiếp. Đổi tháng không đụng tới nhạc. Chỉ bấm ngày khác mới dừng bài cũ và đổi (ngày không có nhạc thì dừng, và không còn trình phát nào). Vừa mở trang thì không phát gì. Một trình phát cho cả danh sách (`useMayPhatDanhSach`, đổi bài bằng `loadVideoById` ngay trong cú bấm).
- Không lớp nào đè lên khung phát ở bất kỳ bề rộng nào; CSP không nới dòng nào.
- Tháng mặc định là tháng của dấu nhạc mới nhất; ngày chọn sẵn là ngày của dấu mới nhất trong tháng đó, tháng không có dấu thì như Lịch hoa (hôm nay, hay ngày cuối tháng).
- Cuốn riêng tư của người kia không có trong trang chọn cuốn, và trang của nó trả 404 thật.

## 17. Bổ sung ngày 26/09

Bảy quyết định chủ dự án đưa ra khi bấm thử dữ liệu mẫu. Spec: `docs/superpowers/specs/2026-09-26-dot-ba-bo-sung.md`.

- **Mọi cuốn mở qua tấm bìa.** Bấm một cuốn trên kệ (hay mở `/sach/<mã>`) thì luôn ra tấm bìa với nút "Mở sách", có nhạc hay không, kể cả khi người xem đã tắt nhạc. Chỉ mở thẳng khi lối vào có `?trang` (khung sách lớn, "Đọc từ trang N", dòng Hoạt động, chuyển hướng sau khi đăng, "Về sách" ở trang trả lời) hoặc `?mo` (nghi thức mở khóa). Còn tấm bìa thì sách và khung hồi đáp chưa gắn.
- **Cột phải của màn đọc dính cả khối** (mục 13).
- **Mép kệ về màu vàng nhạt** của bản mẫu kệ sách đã duyệt (bảng token mục 1). Nét trang trí, không thuộc cổng tương phản.
- **Dải nút kệ không còn thanh hé sách** (mục 5).
- **Lịch Dấu thời gian theo khung Lịch hoa** (mục 16), rồi **bản hai**: lịch gọn, cột phải rộng, trình xem bìa dạng chồng thẻ, nhạc trong ngày phát tuần tự (mục 16).
- **Dải trời cao đúng bằng nội dung**, như bản mẫu dải trời đã duyệt: bỏ khuôn giữ chỗ (chín bài thơ chồng nhau cộng một lời nhắn 80 biểu tượng cảm xúc). Hai trời của chế độ ô cửa sổ vẫn chung một ô lưới, nên đổi chỗ không xô dịch. Thay tâm trạng bằng một bài thơ hay lời nhắn dài ngắn khác thì dải đổi chiều cao **một lần, đúng lúc trời bắt đầu loang**: trời cũ nằm ngoài dòng chảy, phủ kín dải, nên dải không co lại muộn khi dọn.
- **Thả tâm trạng, bản chốt 27/09.** Hộp "Thả tâm trạng" **nổi** ngay dưới dòng tiêu đề, đè lên kệ sách (không đẩy kệ xuống), nên mở hay thu lại lúc nào cũng không xô dịch. Mở thì hộp **thả xuống** từ mép trên (clip-path mở dần từ trên xuống và trượt xuống 6px, 320ms, ease-out), thu lại thì **cuộn lên** (260ms); hộp giữ nguyên độ đậm, không mờ dần. Bấm "Thả" thì hộp **vẫn mở** (khóa lại, không bấm thêm được), trang cuộn lên dải trời **nhanh như một cú cuộn chuột** (0,22 tới 0,6 giây tùy quãng đường, nhanh ngay từ đầu rồi chậm dần; người dùng tự cuộn giữa đường thì nhường ngay; giảm chuyển động thì nhảy thẳng). **Vừa tới đỉnh** dải trời nhận tâm trạng mới **tạm thời** từ trình duyệt và loang ngay, không chờ máy chủ; trong lúc cuộn dải trời giữ nguyên trời cũ dù máy chủ đã lưu xong. **Loang xong** (3,04 giây) hộp mới cuộn lên; không có lần loang (thả lần đầu, giảm chuyển động) thì hộp thu lại ngay khi trời hiện ra. Máy chủ về tới với đúng kiểu trời và lời nhắn đó thì không loang lần hai; máy chủ từ chối thì dải trời về lại tâm trạng cũ, hộp mở khóa (hay mở lại) với lựa chọn cũ và câu báo. Chỉ kiểu trời hay lời nhắn đổi mới là thay tâm trạng: thả lại y nguyên tâm trạng đang giữ chỉ đổi chữ giờ tại chỗ.

## 17a. Đợt bốn (28/09)

Bốn quyết định chủ dự án duyệt qua bản mô phỏng. Spec: `docs/superpowers/specs/2026-09-28-dot-bon-sua-sach.md`.

- **Dấu thời gian chỉ còn nhạc** (mục 16).
- **Sửa trang chỉ viết thêm và sửa chính tả**, máy chủ kiểm lại; chữ cũ bị xoá hiện gạch ngang đúng chỗ và bấm là trả lại (mục 12).
- **Sửa được cả trang niêm phong**: "Sửa trang N" có dưới mọi tờ của chủ sách; niêm phong giữ nguyên, người kia không thấy chữ nào (mục 12). Màn đọc không đổi gì khác.
- **Sửa sách xếp như Sách mới**, bỏ khung Nội dung; Bìa và Nhạc nền là hai dòng thời gian thu gọn, bấm mốc thì bảng chọn rũ xuống, chọn là lưu, có Hoàn tác (mục 15). Viết tiếp giữ nguyên.

## 17c. Đợt năm, phần 5a (30/09)

Chủ dự án duyệt qua bản mô phỏng (phương án A cho dấu Mới, tan chậm). Spec: `docs/superpowers/specs/2026-09-30-dot-nam-a-hoat-dong-ke-sach.md`.

- **Dấu Mới và bảy loại mới** trên cột Hoạt động (mục 8).
- **Khung sách lớn luân phiên** các lượt chưa đọc của cả hai phía (mục 5).
- **Mở sách ở trang đang đọc dở**, theo tài khoản, với mọi cuốn (của mình lẫn của người kia): màn đọc lưu trang trái của khung khi khung đứng yên 1,2 giây; lần sau mở không kèm `?trang` thì ra đúng trang đó, thắng cả "trang đầu chưa đọc". Sửa lượt làm số trang đổi thì vị trí dời theo (nằm trong phần bị cắt thì về trang cuối của lượt). Không có giao diện riêng.
- **Kệ tự cập nhật**: tab đang được xem thì cứ 15 giây (`--dur-tu-cap-nhat`) hỏi một chuỗi phiên bản rẻ; khác lúc vẽ thì làm mới trang (không tải lại). Không làm mới khi đang gõ, khi hộp "Thả tâm trạng" đang mở (hộp tự đánh dấu `data-giu-lam-moi`; không xét `aria-expanded` chung chung vì nút "Mở rộng" kệ giữ nó suốt lúc kệ mở rộng), khi một action đang chạy (`aria-busy`), hay khi dấu Mới còn đang tan.

## 17b. Hiệu năng (27/09, trước khi đưa lên production)

Đo trên bản production ở máy, điện thoại 390px, CPU giả lập chậm 4 lần, trung vị 3 lần (máy đo nhiễu, chỉ tin các thay đổi lớn):

- **Hình vẽ bìa khai một lần.** Mười hình vẽ bìa nằm trong `InkDefs` (layout gốc) cùng bộ lọc mực; mỗi bìa trên trang là `<svg><use href="#bia-ve-…"/></svg>`. Trang chọn cuốn của Dấu thời gian (51 bìa): 846 xuống 536 phần tử DOM, LCP 2,65 xuống 1,99 giây, TBT 666 xuống 420ms. Kệ sách: TBT 1133 xuống 631ms. Đổi lại mỗi trang thêm khoảng 110 phần tử trong `<defs>` (không được vẽ). Nội dung trong `<use>` kế thừa `color`, nên `currentColor` và bộ lọc mực y như cũ.
- **Dải trời khuất thì đứng.** `BauTroi` đặt lớp `troi-khuat` qua IntersectionObserver khi dải trời khuất hẳn khỏi màn hình, CSS dừng mọi nét vẽ `.m`; cuộn về thì chạy tiếp. Đo trên Chrome: 82 hoạt ảnh ở đầu trang, 0 khi đọc kệ phía dưới, 82 khi cuộn về. Lớp riêng, không đụng tới lựa chọn "Tạm dừng hiệu ứng".
- **Không làm, có lý do:** chuỗi khoảng 12 lượt hỏi database của Kệ sách (giao dịch ảnh chụp đọc) tốn 2,1 giây ở máy này vì mỗi lượt 54ms, nhưng production chạy ở `sin1` cùng vùng database nên chỉ cỡ vài chục mili giây; gộp lại dễ mất tính nhất quán mà gần như không được gì. Hạt mưa lặp vô hạn vẫn báo luồng chính mỗi vòng (cách trình duyệt chạy hoạt ảnh CSS, không do `var()`: đã thử bỏ `var()` khỏi keyframes, không đổi gì nên hoàn tác).

## 18. Việc còn lại

`BookCard` (`src/components/book/BookCard.tsx`) cùng các lớp `.book*` trong `app.css` hiện chỉ còn dùng ở ô xem trước của ba màn: tạo sách, sửa sách và Viết tiếp. Khi ba màn đó được vẽ lại, ô xem trước sẽ chuyển sang `ShelfBook` và `BookCard` được bỏ đi.
