# 🔵 Zalo Service - Hướng Dẫn Sử Dụng

Ứng dụng web để tìm kiếm user Zalo theo số điện thoại và gửi tin nhắn hàng loạt từ file Excel.

---

## 📋 Yêu Cầu Hệ Thống

- **Node.js**: phiên bản 14.0 trở lên
- **npm**: phiên bản 6.0 trở lên
- **Trình duyệt web**: Chrome, Firefox, Safari, Edge (phiên bản gần đây)
- **Ứng dụng Zalo**: cài đặt trên điện thoại

---

## 🚀 Cài Đặt & Chạy

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Chạy ứng dụng

**Chế độ thường:**
```bash
npm start
```

**Chế độ phát triển (tự động reload khi có thay đổi):**
```bash
npm run dev
```

### 3. Truy cập ứng dụng

Mở trình duyệt và truy cập:
```
http://localhost:3000
```

---

## 📖 Hướng Dẫn Sử Dụng

### **Bước 1: Quét Mã QR Để Đăng Nhập**

1. Khi ứng dụng khởi động, bạn sẽ thấy **phần "Quét Mã QR Để Đăng Nhập"**
2. Mở ứng dụng **Zalo** trên điện thoại
3. Tìm chức năng **"Quét mã QR"** (thường ở bảng khảo sát hoặc menu)
4. Quét **mã QR** hiển thị trên màn hình
5. Xác nhận đăng nhập trên điện thoại
6. Trạng thái **"Zalo Service"** sẽ chuyển từ 🟡 (Đang kiểm tra) → 🟢 (Đã kết nối)

**⚠️ Lưu ý:** Mã QR chỉ có hiệu lực trong **5 phút**. Nếu hết hạn, nhấn **"🔄 Tải Lại QR"** để lấy mã mới.

---

### **Bước 2: Chuẩn Bị File Excel**

Tạo file Excel với nội dung như sau:

| Cột 1 | Cột 2 | Cột 3 | ...
|-------|-------|-------|-----
| Số điện thoại | (Kết quả tìm kiếm) | (Tên user) | ...
| 0912345678 | | |
| 0987654321 | | |
| ... | | |

**Yêu cầu:**
- Cột đầu tiên phải chứa **số điện thoại hợp lệ**
- Định dạng số: `0xxxxxxxxx` (10 chữ số) hoặc `+84xxxxxxxxx`
- File phải là `.xlsx` hoặc `.xls`

**Ví dụ file Excel:**
```
Số điện thoại
0912345678
0987654321
0903456789
```

---

### **Bước 3: Xử Lý File Excel**

1. Cuộn xuống phần **"📊 Xử Lý File Excel"**

2. **Chọn file Excel:**
   - Nhấn vào ô **"Chọn file Excel"**
   - Chọn file `.xlsx` hoặc `.xls` chứa danh sách số điện thoại

3. **Thiết lập Timeout (tùy chọn):**
   - Timeout là **thời gian chờ tối đa khi gửi mỗi tin nhắn**
   - Giá trị mặc định: **5000 ms (5 giây)**
   - Nếu quá thời gian này, hệ thống sẽ đánh dấu tin nhắn là **gửi thất bại**
   - Phạm vi: 1000-30000 ms
   - **Khuyến nghị:** 5000-10000 ms

4. **Bắt đầu xử lý:**
   - Nhấn nút **"📤 Bắt Đầu Xử Lý"**
   - Hệ thống sẽ bắt đầu xử lý từng số điện thoại:
     - ✅ Kiểm tra định dạng số
     - ✅ Tìm user trên Zalo
     - ✅ Lấy thông tin user (tên, ID, SĐT, avatar)
     - ✅ Gửi tin nhắn tự động
     - ✅ Ghi lại kết quả

5. **Theo dõi tiến độ:**
   - Thanh tiến độ sẽ hiển thị quá trình xử lý
   - Đếm số lượng: `X/Y` (đã xử lý / tổng số)

---

### **Bước 4: Tải Xuống Kết Quả**

Sau khi hoàn thành, bạn sẽ thấy:

```
✅ Xử lý thành công!

Thống kê:
• Tổng số: 100
• Tìm thấy: 85
• Không tìm thấy: 10
• Gửi tin nhắn thành công: 80
• Gửi tin nhắn thất bại: 5
• Lỗi: 5

📥 Tải file kết quả
```

**Nhấn "📥 Tải file kết quả"** để tải file Excel có chứa:
- ✅ Số điện thoại gốc
- ✅ Trạng thái tìm kiếm
- ✅ Tên user
- ✅ ID user
- ✅ Số điện thoại user
- ✅ Avatar URL
- ✅ Kết quả gửi tin nhắn

---

## 📊 Cấu Trúc File Excel Kết Quả

| Cột | Tên | Ý Nghĩa |
|-----|-----|---------|
| 1 | Số điện thoại | Số điện thoại nhập vào |
| 2 | Trạng thái tìm kiếm | "Tìm thấy" / "Không tìm thấy" / "Định dạng sđt không đúng" |
| 3 | Tên user | Tên hiển thị của user Zalo |
| 4 | ID user | ID duy nhất của user trên Zalo |
| 5 | Số điện thoại user | Số điện thoại liên kết với tài khoản Zalo |
| 6 | Avatar URL | Đường dẫn ảnh đại diện |
| 7 | Kết quả gửi tin nhắn | "gửi tn thành công" / "gửi tn thất bại" |

---

## ⚙️ Các Nút Chức Năng

### Phần Trạng Thái Kết Nối
- **🔄 Làm Mới**: Kiểm tra lại trạng thái server và Zalo

### Phần Quét Mã QR
- **🔄 Tải Lại QR**: Tạo mã QR mới (khi mã cũ hết hạn)

### Phần Xử Lý File Excel
- **📤 Bắt Đầu Xử Lý**: Bắt đầu xử lý file Excel
- **❌ Xoá**: Xóa form và làm mới

---

## ❌ Xử Lý Lỗi

### **Lỗi: "Zalo service chưa khởi tạo"**
- **Nguyên nhân**: Chưa quét mã QR hoặc quét thất bại
- **Cách khắc phục**: Quét lại mã QR bằng ứng dụng Zalo

### **Lỗi: "Không có file được tải lên"**
- **Nguyên nhân**: Chưa chọn file Excel
- **Cách khắc phục**: Nhấn chọn file Excel hợp lệ

### **Lỗi: "Định dạng sđt không đúng"**
- **Nguyên nhân**: Số điện thoại không đúng định dạng
- **Cách khắc phục**: Sử dụng định dạng `0xxxxxxxxx` (10 chữ số)

### **Gửi tin nhắn thất bại**
- **Nguyên nhân**: Timeout, user chặn, hoặc lỗi mạng
- **Cách khắc phục**: Tăng giá trị Timeout hoặc thử lại

### **QR code chưa được tạo hoặc hết hạn**
- **Nguyên nhân**: Mã QR hết hạn hoặc server vừa khởi động
- **Cách khắc phục**: Nhấn "🔄 Tải Lại QR"

---

## 🔐 Lưu Ý Quan Trọng

1. **Bảo mật**: 
   - Chỉ sử dụng trên mạng nội bộ hoặc VPN
   - Không chia sẻ file Excel chứa dữ liệu nhạy cảm

2. **Tin nhắn**:
   - Tin nhắn được chọn ngẫu nhiên từ 5 mẫu có sẵn
   - Không thể tùy chỉnh nội dung tin nhắn hiện tại

3. **Tốc độ**:
   - Mỗi tin nhắn có delay 3-5 giây để tránh spam
   - Có thể xử lý 100-200 số/tiếng tùy vào tốc độ mạng

4. **File upload**:
   - File được xóa sau khi xử lý xong
   - Chỉ giữ lại file kết quả

5. **Kết nối Zalo**:
   - Kết nối sẽ được giữ lại cho đến khi server khởi động lại
   - Quét QR lại nếu kết nối bị mất

---

## 📁 Cấu Trúc Thư Mục

```
codeToolZl/
├── index.js                 # Server chính
├── package.json            # Thông tin dự án
├── public/
│   └── index.html          # Giao diện web
├── uploads/                # Thư mục lưu file kết quả
├── qr.png                  # Mã QR đăng nhập
├── node_modules/           # Dependencies
└── README.md              # Tài liệu này
```

---

## 🛠️ Troubleshooting

**Vấn đề**: Server không khởi động
```bash
# Kiểm tra port 3000 có bị chiếm không
# Thay đổi port trong file index.js nếu cần
```

**Vấn đề**: Module không tìm thấy
```bash
# Cài đặt lại dependencies
rm -rf node_modules
npm install
```

**Vấn đề**: File Excel bị lỗi
- Kiểm tra định dạng file `.xlsx` không phải `.xls`
- Kiểm tra số điện thoại có phải là text, không phải number

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra console browser (F12) để xem lỗi
2. Kiểm tra terminal nơi chạy server
3. Thử làm mới trang (Ctrl+F5)
4. Thử quét QR lại

---

**Phiên bản**: 1.0.0  
**Cập nhật lần cuối**: Tháng 1, 2026  
**Trạng thái**: Sử dụng được (Beta)
