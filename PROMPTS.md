# PROMPTS

Tool: Claude Code (Claude Opus 5.5). Prompts are pasted as typed, unedited.
Lines marked `[selected option]` are answers picked from multiple-choice questions the assistant asked.

---

đọc file README.md trong thư mục này trước, phân tích đầy đủ yêu cầu của đề bài, các tiêu chí đánh giá và những thứ must have . sau đó lên plan triển khai cùng tôi, chia thành các bước rõ ràng, từ setup project, thiết kế solution, implement, testing. đừng vội code ngay. có điểm nào chưa rõ hoặc có nhiều hướng triển khai thì hãy hỏi tôi trước khi quyết định. đây là project bài test: C:\Users\chau.nb\flinters\fv-sec-001-software-engineer-challenge

---

đề bài có bắt buộc phải dùng python ở chỗ nào không? Tôi đọc file readme nhưng chưa thấy yêu cầu đó. dùng nodejs + typescript vì đây là stack tôi quen thuộc

[selected option] Streaming, chỉ dùng stdlib (Recommended)
[selected option] Bỏ qua + đếm + log cảnh báo (Recommended)
[selected option] Có cả hai (Recommended)

---

dockerfile ở đây làm gì nhỉ? vì đâu có cần thiết phải dùng docker cho cái console cli này?
ngoài ra, tôi thấy folder structure chưa ổn, hãy đề xuất tôi 1 folder structure rõ ràng hơn, yêu cầu dễ đọc, dễ bảo trì. nhìn vào plan thì nó đang gộp chung logic, helpers, i/o..

---

[selected option] Giữ Dockerfile tối giản
[selected option] Theo layer (Recommended)
[selected option] Có ESLint + Prettier (Recommended)

---

ê, sao không tách nó ra 1 folder riêng ấy

[selected option] Toàn bộ code TS ra folder riêng

---

tạo cho tôi một agent chuyên review code nhé, tập trung vào backend, đặc biệt là nodejs và typescript. 
tôi muốn agent này review code theo hướng thực tế, không chỉ kiểm tra style mà còn tìm các vấn đề về correctness, error handling, type safety, async behavior, resource management, performance và maintainability. đặc biệt chú ý đến việc streaming file csv lớn, sử dụng bộ nhớ, xử lý dữ liệu không hợp lệ, logic và các edge cases

---

tạo và chạy được chưa? tự nhiên tắt của tôi đi thế? cli ý

---

ok fix hết nhé. cái file prompts.md bạn cũng thêm cho tôi nhé
