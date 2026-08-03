# AGENTS.md — luật làm việc cho agent trên repo wsedit

File này dành cho **agent** (Antigravity/`agy`, Codex, Claude Code subagent). Người đọc là máy, không phải người.
Đọc hết trước khi ghi dòng code đầu tiên.

## Nguồn sự thật — đọc theo đúng thứ tự này

1. `docs/agents/PHASE0.md` — kết quả đo trên máy thật. **Ưu tiên cao nhất.** Trái với file này là sai, kể cả khi SPEC nói khác.
2. `docs/agents/CONTRACTS.md` — signature chốt giữa các module. Không tự đổi.
3. `SPEC.md` — yêu cầu chức năng, layout, keymap, phạm vi v1.
4. `CLAUDE.md` — coding style của repo.
5. `docs/agents/BOARD.md` — task của bạn, trạng thái, ai sở hữu file nào.

Xung đột giữa các file → PHASE0 thắng SPEC, SPEC thắng suy đoán của bạn. Không tự hoà giải: ghi vào BOARD mục
"Cần Lead chốt" rồi làm việc khác.

## Vai trò

**Lead = Claude (người điều phối).** Lead sở hữu: `bin/wsedit.js`, `src/commands/*`, contract, review, commit/push.
Agent **không** chạy `git` — không commit, không push, không tạo branch. Lead làm việc đó sau khi review.

Mỗi agent nhận một task ID trong BOARD kèm **danh sách file được phép ghi**.

## Luật cứng — vi phạm là fail, không thương lượng

1. **Chỉ ghi vào file mà task của bạn sở hữu.** Thấy bug ở file người khác → ghi vào BOARD, không sửa.
2. **Không đổi signature trong CONTRACTS.md.** Cần đổi → đề xuất trong BOARD, chờ Lead.
3. **Không thêm dependency.** Stack đã chốt: commander, blessed, cli-highlight, chalk, blessed-xterm, node-pty.
   `chalk` **giữ ở `^4`** — v5 là ESM-only, `require()` sẽ vỡ.
4. **CommonJS.** `require`, `module.exports`, `"use strict"` đầu file. Không `import`, không `type: module`.
5. **`src/core/**` không được require `blessed` hoặc `node-pty`.** Đây là ranh giới test. Có gate kiểm tự động.
6. **Text hiện cho người dùng là tiếng Việt.** Tên biến, tên hàm, comment: tiếng Anh.
7. **Không sửa `bin/wsedit.js` và `src/commands/*`** — Lead sở hữu.
8. **Không đánh dấu xong mục nào trong PHASE0 §8.** Chúng cần TTY thật, chỉ người dùng xác nhận được.
9. **Không tự ý cài lại `node_modules`, không xoá `package-lock.json`.**
10. **Báo cáo thật.** Test fail thì nói fail kèm output. Không viết "GREEN" khi chưa chạy. Không mock/stub
    để bắt test pass. Lead sẽ chạy lại gate độc lập — khai gian sẽ bị phát hiện.

## Style — copy theo file hiện có

- Double quote, semicolon, indent 2 space.
- `fs` sync trong code chạy ngắn (lệnh CLI). Nhưng **UI là process sống lâu**: dùng async cho IO có thể chậm
  (`file-index.js`). Đây là ngoại lệ có ý thức so với CLAUDE.md.
- Lỗi: `Error` với message tiếng Việt, đọc được.
- Comment chỉ giải thích **tại sao**, không diễn giải lại code.
- Không để lại code chết, import không dùng, code comment-out.
- Early return thay vì lồng if sâu.

## Quy trình mỗi task

1. Đọc task trong `BOARD.md` → lấy danh sách file sở hữu.
2. Đọc contract của **chính** module đó trong `CONTRACTS.md`. Module khác cứ giả định đúng contract.
3. Viết code. Chỉ trong file được sở hữu.
4. **Tự chạy gate** (bên dưới). Fail thì sửa, đừng bàn giao đồ vỡ.
5. Cập nhật `BOARD.md`: đổi trạng thái task thành `DONE-CHO-REVIEW`, ghi 1–3 dòng đã làm gì.
6. Thêm 1 dòng vào `docs/agents/CHANGELOG.md` dưới đúng Phase của task.
7. **Dừng.** Không tự nhận task tiếp. Lead phân task mới.

## Gate — phải chạy trước khi báo xong

```bash
# 1. Không phá 3 lệnh cũ (regression — điều kiện nghiệm thu Phase 1)
node bin/wsedit.js --help
node bin/wsedit.js ls
node bin/wsedit.js view package.json

# 2. Unit test (nếu repo đã có test/)
node --test test/

# 3. Ranh giới core: lệnh sau phải KHÔNG in ra gì
grep -rn "require(\"blessed\")\|require(\"node-pty\")" src/core/

# 4. Cú pháp mọi file bạn đã sửa
node --check <file>
```

Nếu task của bạn thuộc `src/ui/**`, thêm: `node --test test/smoke-ui.test.js` (dựng screen bằng stream giả,
không cần TTY — xem `docs/agents/CONTRACTS.md`).

## Điều tuyệt đối không làm

- Không đổi hành vi 3 lệnh `view` / `ls` / `edit`. Chúng phải chạy y như trước refactor.
- Không đổi `wsedit` không tham số thành mở UI (breaking change — SPEC §3 đã chốt).
- Không gọi `pty.kill()` ở đường thoát (PHASE0 §7 — gây rác stderr và không giúp thoát).
- Không dùng `"100%"` cho width/height của widget terminal (PHASE0 §5.2 — sẽ TypeError).
- Không thêm confirm khi nhấn Esc trong lệnh `edit` cũ (CLAUDE.md: hành vi cố ý).
