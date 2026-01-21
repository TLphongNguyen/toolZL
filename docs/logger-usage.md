# Sử dụng Logger mới

## API Logger

Logger mới được thiết kế để ghi log trực tiếp theo format dễ đọc với timezone GMT+7.

### 1. Bắt đầu Job

```javascript
import { startJob } from '../utils/logger.js';

// Bắt đầu job mới - sẽ ghi header vào log file
startJob(jobId, totalPhones, invalidCount);
```

**Ví dụ:**
```javascript
startJob('excel_1768936327429', 665, 252);
```

### 2. Log thành công

```javascript
import { logSuccess } from '../utils/logger.js';

// Khi gửi tin nhắn thành công
logSuccess(phone, {
  name: userName,      // optional
  avatar: avatarUrl,   // optional
  message: messageText, // optional
  processingTime: '1.2s' // optional
});
```

**Ví dụ:**
```javascript
logSuccess('0372553487', {
  name: 'Nguyễn Văn A',
  avatar: 'https://avatar.url/image.jpg',
  message: 'Chào bạn, chúng tôi có chương trình...',
  processingTime: '0.8s'
});
```

### 3. Log lỗi tìm user

```javascript
import { logFindUserFailed } from '../utils/logger.js';

// Khi không tìm thấy hoặc user không hợp lệ
logFindUserFailed(phone, errorMessage);
```

**Ví dụ:**
```javascript
logFindUserFailed('0974981248', 'User không hợp lệ');
logFindUserFailed('0383969245', 'Không tìm thấy');
logFind UserFailed('0985678968', 'Vượt quá số request cho phép');
```

### 4. Log lỗi gửi tin nhắn

```javascript
import { logSendMessageFailed } from '../utils/logger.js';

// Khi gửi tin nhắn thất bại
logSendMessageFailed(phone, errorMessage, uid);
```

**Ví dụ:**
```javascript
logSendMessageFailed(
  '0912112925', 
  'Bạn chưa thể gửi tin nhắn đến người này vì người này chặn không nhận tin nhắn từ người lạ.',
  '8891560639747801456'
);
```

### 5. Kết thúc Job

```javascript
import { endJob } from '../utils/logger.js';

// Kết thúc job - sẽ ghi summary và thống kê vào log file
endJob();
```

---

## Ví dụ tích hợp vào Excel Service

```javascript
import { 
  startJob, 
  logSuccess, 
  logFindUserFailed, 
  logSendMessageFailed,
  endJob 
} from '../utils/logger.js';

export async function processExcelFile({ filePath, jobId, ... }) {
  try {
    // Đếm số điện thoại
    const { totalPhones, invalid } = countValidPhonesInExcel({ filePath });
    
    // Bắt đầu ghi log
    startJob(jobId, totalPhones, invalid);
    
    // Xử lý từng số điện thoại
    for (let phone of phones) {
      try {
        const user = await zaloApi.findUser(phone);
        
        if (!user) {
          logFindUserFailed(phone, 'Không tìm thấy');
          continue;
        }
        
        const uid = user.uid;
        const userName = user.name;
        const userAvatar = user.avatar;
        
        try {
          const message = 'Chào bạn...';
          await zaloApi.sendMessage(message, uid);
          
          // Log thành công
          logSuccess(phone, {
            name: userName,
            avatar: userAvatar,
            message: message,
            processingTime: '1.2s'
          });
        } catch (sendError) {
          // Log lỗi gửi tin nhắn
          logSendMessageFailed(phone, sendError.message, uid);
        }
      } catch (findError) {
        // Log lỗi tìm user
        logFindUserFailed(phone, findError.message);
      }
    }
    
    // Kết thúc và ghi summary
    endJob();
    
  } catch (error) {
    endJob(); // Vẫn cần ghi summary dù có lỗi
    throw error;
  }
}
```

---

## Output mẫu

File log sẽ có format như sau:

```
════════════════════════════════════════════════════════════════════════════════
📋 LOG GỬI TIN NHẮN ZALO - Job: excel_1768936327429
📅 Thời gian bắt đầu: 2026-01-21 09:12:07 (GMT+7)
📊 Tổng số: 665 | Không hợp lệ: 252
════════════════════════════════════════════════════════════════════════════════

[001/665] [09:12:07.451 GMT+7] ✅ ĐÃ GỬI
├─ 📞 Số điện thoại: 0372553487
├─ 👤 Họ tên: Nguyễn Văn A
├─ 🖼️  Avatar: https://avatar.url/image.jpg
├─ 📊 Trạng thái: ĐÃ GỬI THÀNH CÔNG
├─ 💬 Nội dung: Chào bạn, chúng tôi có chương trình...
└─ ⏱️  Thời gian xử lý: 0.8s
────────────────────────────────────────────────────────────────────────────────

[002/665] [09:12:07.759 GMT+7] ❌ TÌM USER THẤT BẠI
├─ 📞 Số điện thoại: 0974981248
├─ 👤 Họ tên: [Không xác định]
├─ 🖼️  Avatar: N/A
├─ 📊 Trạng thái: USER KHÔNG HỢP LỆ
├─ 💬 Nội dung: [Không gửi được]
└─ ⚠️  Lỗi: User không hợp lệ
────────────────────────────────────────────────────────────────────────────────

...
════════════════════════════════════════════════════════════════════════════════
📊 THỐNG KÊ TỔNG KẾT
════════════════════════════════════════════════════════════════════════════════
⏰ Job ID: excel_1768936327429
🌍 Timezone: GMT+7 (Việt Nam)
📅 Bắt đầu: 2026-01-21 09:12:07
⏹️  Kết thúc: 2026-01-21 09:18:32
⏱️  Thời gian chạy: 6 phút 25 giây
────────────────────────────────────────────────────────────────────────────────
📞 Tổng số điện thoại: 665
📋 Số không hợp lệ (từ file): 252
📈 Đã xử lý: 62
────────────────────────────────────────────────────────────────────────────────
✅ Gửi thành công: 24
❌ Thất bại: 38
  ├─ User không hợp lệ: 7
  ├─ Không tìm thấy: 5
  ├─ Bị chặn tin nhắn: 1
  └─ Vượt quá request: 25
────────────────────────────────────────────────────────────────────────────────
📊 Tỷ lệ thành công: 38.71%
════════════════════════════════════════════════════════════════════════════════
```

---

## Legacy Functions

Các function cũ vẫn tồn tại cho backward compatibility:
- `logInfo(message, extra)` - log ra console
- `logError(message, extra)` - log ra console
- `getLogFilePath()` - trả về đường dẫn file log

**Lưu ý:** Các function này không ghi vào file log mới nữa, chỉ log ra console.
