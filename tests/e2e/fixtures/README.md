# Ảnh mẫu cho e2e

Sinh bằng `sinh-anh-mau.py` (pillow-heif 1.7.0, libheif 1.23.3, x265 4.3, Pillow 12.3.0):
`python -m venv .venv && .venv/Scripts/python -m pip install pillow-heif==1.7.0 pillow && .venv/Scripts/python sinh-anh-mau.py`
(chạy trong thư mục chứa một thư mục con `fixtures/`, rồi chép bốn tệp ra đây).

Hình 120x80: dải màu đỏ sang xanh dương, ô xanh lá 20x20 ở góc trên trái, ô trắng 10x10 ở góc dưới phải.

| Tệp | Byte | Ghi chú |
|---|---|---|
| plain.heic | 587 | ftyp heic, tương thích mif1 heic miaf |
| orient6.heic | 698 | lưu 120x80, hộp irot góc 3 và EXIF Orientation 6: hiện đúng là 80x120, ô xanh lá ở góc trên phải |
| plain.avif | 508 | ftyp avif, tương thích avif mif1 miaf MA1B |
| plain.png | 314 | ảnh gốc để so |
